const { query } =
    require("../db");

async function paginate({
  table,
  mapper,
  page = 1,
  pageSize = 20,
  orderBy = "created_at DESC",
}) {
  const offset = (page - 1) * pageSize;

  const [rowsResult, countResult] = await Promise.all([
    query(
      `
      SELECT *
      FROM ${table}
      ORDER BY ${orderBy}
      LIMIT $1
      OFFSET $2
      `,
      [pageSize, offset]
    ),

    query(
      `
      SELECT COUNT(*) AS total
      FROM ${table}
      `
    ),
  ]);

  return {
    data: rowsResult.rows.map(mapper),
    pagination: {
      page,
      pageSize,
      total: Number(countResult.rows[0].total),
      totalPages: Math.ceil(
        Number(countResult.rows[0].total) / pageSize
      ),
    },
  };
}
module.exports = { paginate };