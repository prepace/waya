import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
        const { task, name, firstname, lastname, email, phone } = body || {};

        if (!task || !name || !firstname || !lastname || !email || !phone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { error } = await supabase
            .from('tasks')
            .insert([
                {
                    timestamp: new Date().toISOString(),
                    task,
                    name,
                    firstname,
                    lastname,
                    email,
                    phone,
                    status: 'New',
                },
            ]);

        if (error) {
            console.error('Supabase insert error:', error);
            return NextResponse.json({ error: 'Failed to write to Supabase' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Submit handler error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
