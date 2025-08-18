// app/api/submit/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
        const { task, name, firstname, lastname, email, phone, worth } = body || {};

        if (!task || !name || !firstname || !lastname || !email || !phone || !worth) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1) Insert the task and return its id
        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                timestamp: new Date().toISOString(),
                task, name, firstname, lastname, email, phone, worth, status: 'New'
            }])
            .select('id')   // <-- important to get the new PK
            .single();

        if (error || !data?.id) {
            console.error('Supabase insert error:', error);
            return NextResponse.json({ error: 'Failed to write to Supabase' }, { status: 500 });
        }

        const taskId = data.id;

        // 2) Call internal /api/ideas to generate & save ideas (don’t block success if it fails)
        const origin = new URL(request.url).origin; // works on Vercel/Next
        try {
            const ideasResp = await fetch(`${origin}/api/ideas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // send whatever you want ideas to consider
                body: JSON.stringify({ taskId, task, worth })
            });

            // We won’t fail the submission if ideas step fails
            if (!ideasResp.ok) {
                const errTxt = await ideasResp.text();
                console.error('Ideas route error:', ideasResp.status, errTxt);
            }
        } catch (e) {
            console.error('Ideas call failed:', e);
        }

        return NextResponse.json({ success: true, task_id: taskId });
    } catch (err) {
        console.error('Submit handler error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
