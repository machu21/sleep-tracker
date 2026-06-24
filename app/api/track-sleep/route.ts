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
    const { status, sleep_start_time } = await request.json(); 

    if (status === 'AWAKE' && sleep_start_time) {
      // Logic: Only insert into history when user wakes up
      const sleepDate = new Date(sleep_start_time);
      const wakeDate = new Date();
      const duration = ((wakeDate.getTime() - sleepDate.getTime()) / 3_600_000).toFixed(1);

      await supabase.from('sleep_logs').insert([{
        sleep_time: sleep_start_time,
        wake_time: wakeDate.toISOString(),
        duration_hours: duration,
        created_at: wakeDate.toISOString()
      }]);
    }

    return NextResponse.json({ message: 'Live status updated/History logged' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}