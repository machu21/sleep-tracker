// app/api/track-sleep/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use the Service Role Key for server-side administrative access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! 
);

export async function POST(request: Request) {
  try {
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('sleep_logs')
      .insert([{ status }]);

    if (error) throw error;

    return NextResponse.json({ message: 'Success', data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}