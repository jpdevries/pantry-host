import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | undefined;

function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is not set');
    // connect_timeout fails fast when the DB is unreachable (e.g.
    // Tailscale flapped, Mini asleep, wrong DATABASE_URL) so the
    // surrounding try/catch in getServerSideProps fires instead of
    // Rex's GSSP wrapper hitting its microtask checkpoint timeout.
    _sql = postgres(url, { max: 10, connect_timeout: 5, idle_timeout: 20 });
  }
  return _sql;
}

const handler: ProxyHandler<object> = {
  apply(_target, thisArg, args) {
    return Reflect.apply(getSql() as never, thisArg, args);
  },
  get(_target, prop) {
    return Reflect.get(getSql() as never, prop);
  },
};

const sql = new Proxy(function () {}, handler) as ReturnType<typeof postgres>;

export default sql;
