// Account deletion is moot while there are no accounts. Disabled.
export const POST = async () => new Response(
  JSON.stringify({ ok: false, error: 'disabled' }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }
);
