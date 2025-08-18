// app/api/ideas/route.js
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
    try {
        const { taskId, task } = await request.json();

        if (!taskId || !task?.trim()) {
            return NextResponse.json({ error: 'Missing required fields: taskId, task' }, { status: 400 });
        }

        // ----- Prompt -----
        const system = [
            "You are an agency operations lead designing SAME-DAY actions for a task someone is avoiding.",
            "Output must be practical, concrete, and executable by a virtual agent within 24 hours.",
            "Incorporate the user's reason for avoiding the task to remove friction (e.g., anxiety, ambiguity, time, skills).",
            "Assume an agent can: research, draft emails, create checklists/docs, book calls/appointments, gather quotes, set up simple automations, and follow up.",
            "Prefer solutions that reach DONE or near-done without the user, or that reduce the user's effort to <15 minutes.",
            "Be specific about steps, success criteria, and what to send back to the user."
        ].join(' ');

        const user = `Task user is avoiding: "${task.trim()}"`;

        // ----- Structured output spec -----
        const response_format = {
            type: 'json_schema',
            json_schema: {
                name: 'agent_solution_bundle',
                strict: true,
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        solutions: {
                            type: 'array',
                            minItems: 5,
                            maxItems: 5,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    title: { type: 'string' },
                                    why_it_helps: { type: 'string' },
                                    steps_agent_will_do_today: {
                                        type: 'array',
                                        minItems: 3,
                                        items: { type: 'string' }
                                    },
                                    deliverables_to_user: {
                                        type: 'array',
                                        minItems: 1,
                                        items: { type: 'string' }
                                    },
                                    success_criteria: {
                                        type: 'array',
                                        minItems: 2,
                                        items: { type: 'string' }
                                    },
                                    dependencies_or_access_needed: {
                                        type: 'array',
                                        items: { type: 'string' }
                                    },
                                    risk_mitigation: {
                                        type: 'array',
                                        items: { type: 'string' }
                                    },
                                    est_time_hours_today: { type: 'number' },
                                    price_suggestion_usd: { type: 'number' }
                                },
                                required: [
                                    'title',
                                    'why_it_helps',
                                    'steps_agent_will_do_today',
                                    'deliverables_to_user',
                                    'success_criteria',
                                    'dependencies_or_access_needed',
                                    'risk_mitigation',
                                    'est_time_hours_today',
                                    'price_suggestion_usd'
                                ]
                            }
                        },
                        quick_note_for_agent: {
                            type: 'string',
                            description: 'One-paragraph ops note with gotchas/checklists.'
                        }
                    },
                    required: ['solutions', 'quick_note_for_agent']
                }
            }
        };

        // ----- Call Responses API -----
        const resp = await client.responses.create({
            model: 'gpt-5-nano',
            input: [
                { role: 'system', content: [{ type: 'text', text: system }] },
                { role: 'user', content: [{ type: 'text', text: user }] }
            ],
            text: { format: response_format }
        });

        // Extract structured JSON
        const out = resp.output?.[0]?.content?.[0]?.text;
        const parsed = typeof out === 'string' ? safeJson(out) : out;

        if (!parsed?.solutions) {
            return NextResponse.json({ error: 'Model did not return expected JSON.' }, { status: 502 });
        }

        // ----- Save ideas to Supabase -----
        const solutionCount = Array.isArray(parsed.solutions) ? parsed.solutions.length : null;

        const { data, error } = await supabase
            .from('ideas')
            .insert([{
                task_id: taskId,
                model: 'gpt-5-nano',
                output: parsed,
                quick_note_for_agent: parsed.quick_note_for_agent || null,
                solution_count: solutionCount
            }])
            .select('id')
            .single();

        if (error || !data?.id) {
            console.error('Supabase ideas insert error:', error);
            return NextResponse.json({ error: 'Failed to save ideas' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            ideas_id: data.id,
            output: parsed
        });
    } catch (err) {
        const message = err?.message || 'OpenAI request failed';
        return NextResponse.json({ error: message }, { status: err?.status || 500 });
    }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
