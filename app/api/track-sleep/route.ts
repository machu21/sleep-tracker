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

    // ESP32 sends one of two payload shapes:
    //
    //  A) Simple status update:
    //     { "status": "SLEEPING" }
    //     { "status": "EMPTY" }
    //     { "status": "AWAKE" }           ← plain AWAKE with no session data
    //
    //  B) Wake-up event with session data:
    //     { "status": "AWAKE", "sleep_start_millis": 123456, "sleep_duration_s": 3720 }

    const { status, sleep_start_millis, sleep_duration_s } = body;

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    // ── 1. Always broadcast for the live dashboard UI ──────────────────────
    await supabase.channel('live-status').send({
      type: 'broadcast',
      event: 'status-update',
      payload: { status },
    });

    // ── 2. Log a sleep session only when waking up WITH session data ───────
    //    Plain AWAKE pings (no sleep_duration_s) are ignored for logging —
    //    they only update the live status above.
    if (status === 'AWAKE' && sleep_duration_s !== undefined) {
      const durationSec = parseInt(String(sleep_duration_s), 10);

      if (isNaN(durationSec) || durationSec <= 0) {
        return NextResponse.json(
          { error: 'Invalid sleep_duration_s' },
          { status: 400 }
        );
      }

      const wakeTime  = new Date();
      const sleepTime = new Date(wakeTime.getTime() - durationSec * 1000);
      const durationHours = (durationSec / 3600).toFixed(1);

      console.log(`[track-sleep] Logging session:
        sleep_time:     ${sleepTime.toISOString()}
        wake_time:      ${wakeTime.toISOString()}
        duration_hours: ${durationHours}
        raw_duration_s: ${durationSec}`);

      const { error } = await supabase.from('sleep_logs').insert([{
        sleep_time:     sleepTime.toISOString(),
        wake_time:      wakeTime.toISOString(),
        duration_hours: durationHours,
        created_at:     sleepTime.toISOString(), // row date = when sleep started
      }]);

      if (error) throw error;

      return NextResponse.json({
        message: 'Session logged',
        sleep_time: sleepTime.toISOString(),
        wake_time:  wakeTime.toISOString(),
        duration_hours: durationHours,
      }, { status: 200 });
    }

    // ── 3. All other statuses (SLEEPING, EMPTY, plain AWAKE) ───────────────
    //    Broadcast-only, no DB write needed.
    return NextResponse.json({ message: 'Status broadcasted' }, { status: 200 });

  } catch (error: any) {
    console.error('[track-sleep] API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}