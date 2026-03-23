const GET = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": "dsn_user=; Path=/; Max-Age=0"
    }
  });
};
  __proto__: null,
  GET
export {
  page
};