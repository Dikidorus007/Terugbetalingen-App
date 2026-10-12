import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret || req.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    const expense = payload.record;
    if (payload.type !== "INSERT" || payload.table !== "expenses" || !expense?.id) {
      return Response.json({ skipped: true }, { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey) {
      throw new Error("Missing required Supabase or VAPID environment variables");
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const targetNames = new Set<string>();
    const splitNames = [...new Set((Array.isArray(expense.splits) ? expense.splits : [])
      .map((split: { person?: unknown }) => typeof split.person === "string" ? split.person : "")
      .filter((name: string) => name && name !== expense.payer))];

    if (splitNames.length) {
      const { data: accounts, error: accountsError } = await admin
        .from("accounts").select("name,members").in("name", splitNames);
      if (accountsError) throw accountsError;
      const accountNames = new Set((accounts || []).map((account: { name: string }) => account.name));

      for (const name of splitNames) {
        if (!accountNames.has(name)) targetNames.add(name);
      }
      for (const account of accounts || []) {
        if (Array.isArray(account.members)) {
          for (const member of account.members) {
            if (typeof member === "string" && member !== expense.payer) targetNames.add(member);
          }
        }
      }
    }

    if (!targetNames.size) {
      return Response.json({ sent: 0 }, { status: 200, headers: corsHeaders });
    }

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("endpoint,subscription,person_name")
      .in("person_name", [...targetNames]);
    if (subscriptionsError) throw subscriptionsError;

    const message = JSON.stringify({
      title: "Nieuwe kost ontvangen",
      body: `${expense.description || "Nieuwe kost"} · €${Number(expense.amount || 0).toFixed(2).replace(".", ",")}`,
      expenseId: expense.id,
      url: "./"
    });

    let sent = 0;
    const staleEndpoints: string[] = [];
    for (const row of subscriptions || []) {
      try {
        await webpush.sendNotification(row.subscription, message);
        sent++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) staleEndpoints.push(row.endpoint);
        else console.error("Push delivery failed", statusCode || "unknown");
      }
    }

    if (staleEndpoints.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }
    return Response.json({ sent }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Push notification handler failed", error);
    return Response.json({ error: "Notification delivery failed" }, { status: 500, headers: corsHeaders });
  }
});
