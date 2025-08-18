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
        const { taskId, task, worth } = await request.json();

        if (!taskId || !task?.trim() || worth === undefined) {
            return NextResponse.json({ error: 'Missing required fields: taskId, task, worth' }, { status: 400 });
        }

        // ----- Prompt -----
        const system = [
            "You are an agency ops lead creating ONE no-brainer, done-for-you plan to complete the user’s avoided task TODAY.",
            "Incorporate the user's reason for avoiding the task to remove friction (e.g., anxiety, ambiguity, time, skills).",
            "Anchor the proposal to at least 5–10x the dollar worth the user said it would mean to them. The services will be performed 100% by an agentic system which we will call a high-performance executive assistant",
            "Assume a state-of-the-art agentic system can: research, draft emails, create checklists/docs, book calls/appointments, handle live inbound/outbound calls, gather quotes, set up simple automations, and follow up.",
            "Include: a clear title, why it helps, the exact steps an agent will take today, deliverables with explicit $ value for each, a stacked total_value_usd, success criteria, access needed, risk mitigation, estimated time today, a guarantee, AND a suggested_price_usd for the user.",
            "The suggested price must be between the user's stated worth (as the minimum) and one-third of the stacked total value (as the maximum). Choose a number in that range that feels fair and irresistible.",
            "Keep it simple, fun, and friction-free: the user should only need <15 minutes to approve or hand off."
        ].join(' ');

        const user = `Task: "${task.trim()}". User says getting this done is worth $${worth}.`;

        // ----- Structured output spec -----
        const response_format = {
            name: 'agent_proposal',
            type: 'json_schema',
            // place the actual JSON Schema at top-level `schema` so it maps to text.format.schema
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    proposal: {
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
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        description: { type: 'string' },
                                        value_usd: { type: 'number' }
                                    },
                                    required: ['description', 'value_usd']
                                }
                            },
                            total_value_usd: { type: 'number' },
                            suggested_price_usd: { type: 'number' },
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
                            guarantee: { type: 'string' }
                        },
                        required: [
                            'title',
                            'why_it_helps',
                            'steps_agent_will_do_today',
                            'deliverables_to_user',
                            'total_value_usd',
                            'suggested_price_usd',
                            'success_criteria',
                            'dependencies_or_access_needed',
                            'risk_mitigation',
                            'est_time_hours_today',
                            'guarantee'
                        ]
                    },
                    quick_note_for_agent: { type: 'string' }
                },
                required: ['proposal', 'quick_note_for_agent']
            }
        };

        const payload = {
            model: 'gpt-5-nano',
                input: [
                    { role: 'system', content: [{ type: 'input_text', text: system }] },
                    { role: 'user', content: [{ type: 'input_text', text: user }] }
                ],
                text: { format: response_format }
        };

        console.log('Payload for Responses API:', JSON.stringify(payload, null, 2));

        // ----- Call Responses API -----
        const resp = await client.responses.create(payload);

        // Responses API should populate `output_parsed` when using json_schema.
        // But sometimes the structured output can appear in other places. Try several fallbacks
        // and log the raw response for debugging.
        try {
            console.log('Responses API raw output:', JSON.stringify(resp?.output?.slice(0, 5) || resp, null, 2));
        } catch {
            // ignore logging errors
        }

        const parsed = (() => {
            // 1) preferred parsed output
            if (resp.output_parsed) return resp.output_parsed;

            // 2) scan outputs for content items that may contain JSON as text
            const outputs = resp.output || [];
            for (const outItem of outputs) {
                const contents = outItem.content || [];
                for (const c of contents) {
                    // output_text is commonly used for plain text results
                    if (c.type === 'output_text' && typeof c.text === 'string') {
                        const j = safeJson(c.text);
                        if (j) return j;
                    }
                    // some SDKs/models may include parsed schema directly
                    if (c.type === 'output_schema' && c.parsed) return c.parsed;
                    // fallback: if there's a text field that looks like JSON
                    if (c.text && typeof c.text === 'string') {
                        const j = safeJson(c.text);
                        if (j) return j;
                    }
                }
            }

            // 3) last resort: try the first content text
            const text = resp.output?.[0]?.content?.[0]?.text;
            if (typeof text === 'string') return safeJson(text) || null;

            return null;
        })();

        if (!parsed?.proposal) {
            console.error('Model response did not include expected `proposal` field.');
            return NextResponse.json({ error: 'Model did not return expected JSON.' }, { status: 502 });
        }

        // ----- Save to Supabase -----
        const { data, error } = await supabase
            .from('ideas')
            .insert([{
                task_id: taskId,
                model: 'gpt-5-nano',
                output: parsed,
                quick_note_for_agent: parsed.quick_note_for_agent || null
            }])
            .select('id')
            .single();

        if (error || !data?.id) {
            console.error('Supabase ideas insert error:', error);
            return NextResponse.json({ error: 'Failed to save proposal' }, { status: 500 });
        }

        // Also mark the original task as Planned in the tasks table
        const { error: taskUpdateErr } = await supabase
            .from('tasks')
            .update({ status: 'Planned' })
            .eq('id', taskId);

        if (taskUpdateErr) {
            console.error('Supabase tasks update error:', taskUpdateErr);
            return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 });
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

// Robust JSON parser: trims, strips ```json fences and surrounding quotes, then JSON.parse
function safeJson(s) {
    if (!s || typeof s !== 'string') return null;
    let t = s.trim();
    // remove surrounding ``` or ```json fences
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    // remove wrapping quotes if the whole payload is quoted
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        t = t.slice(1, -1).trim();
    }
    try {
        return JSON.parse(t);
    } catch {
        return null;
    }
}
