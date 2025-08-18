// app/api/admin/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // server-only
);

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const pw = searchParams.get('pw') || '';
        if (!pw || pw !== process.env.ADMIN_PASSWORD) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1) tasks
        const { data: tasks, error: tErr } = await supabase
            .from('tasks')
            .select('id,timestamp,firstname,lastname,name,email,phone,task,status,worth')
            .order('timestamp', { ascending: false });

        if (tErr) throw tErr;

        // 2) ideas (latest-first)
        const { data: ideas, error: iErr } = await supabase
            .from('ideas')
            .select('id,task_id,created_at,model,output,quick_note_for_agent')
            .order('created_at', { ascending: false });

        if (iErr) throw iErr;

        const latestByTask = new Map();
        for (const row of ideas || []) {
            if (!latestByTask.has(row.task_id)) latestByTask.set(row.task_id, row);
        }

        // 3) merge
        const rows = (tasks || []).map(t => {
            const idea = latestByTask.get(t.id);
            const proposal = idea?.output?.proposal || null;
            return {
                ...t,
                idea_id: idea?.id ?? null,
                idea_created_at: idea?.created_at ?? null,
                model: idea?.model ?? null,
                quick_note_for_agent: idea?.quick_note_for_agent ?? null,
                proposal
            };
        });

        return NextResponse.json({ rows });
    } catch (err) {
        console.error('admin-data error:', err);
        return NextResponse.json({ error: 'Failed to load admin data' }, { status: 500 });
    }
}
