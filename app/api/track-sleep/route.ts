// app/api/track-sleep/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

    // 1. Always Broadcast for the Live UI
    await supabase.channel('live-status').send({
      type: 'broadcast',
      event: 'status-update',
      payload: { status },
    });

    // 2. Log to Database only when waking up
    if (status === 'AWAKE' && sleep_start_time) {
      const now = new Date();
      
      // Calculate duration: 
      // If ESP32 sends millis since boot, we assume current time is (now - sleep_start_time_ms)
      // Note: This assumes sleep_start_time is a Unix timestamp (ms) or logic-calculated start
      const durationMs = parseInt(sleep_start_time); 
      const durationHours = (durationMs / 3_600_000).toFixed(1);

      const { error } = await supabase.from('sleep_logs').insert([{
        sleep_time: new Date(now.getTime() - durationMs).toISOString(),
        wake_time: now.toISOString(),
        duration_hours: durationHours,
        created_at: now.toISOString()
      }]);

      if (error) throw error;
    }

    return NextResponse.json({ message: 'Broadcasted and/or Logged' }, { status: 200 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}