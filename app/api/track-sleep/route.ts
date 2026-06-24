// app/api/track-sleep/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { status, sleep_start_time } = body;

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    // 1. Broadcast the status for the Live UI (Instant, No DB write)
    // This updates your web app's "Live Status" card immediately
    await supabase.channel('live-status').send({
      type: 'broadcast',
      event: 'status-update',
      payload: { status },
    });

    // 2. Only write to the DB if the person wakes up (History Logging)
    if (status === 'AWAKE' && sleep_start_time) {
      const sleepDate = new Date(sleep_start_time);
      const wakeDate = new Date();
      
      // Calculate duration in hours
      const duration = ((wakeDate.getTime() - sleepDate.getTime()) / 3_600_000).toFixed(1);

      const { error } = await supabase.from('sleep_logs').insert([{
        sleep_time: sleepDate.toISOString(),
        wake_time: wakeDate.toISOString(),
        duration_hours: duration,
        created_at: wakeDate.toISOString()
      }]);

      if (error) throw error;
    }

    return NextResponse.json({ message: 'Status broadcasted and logged successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}