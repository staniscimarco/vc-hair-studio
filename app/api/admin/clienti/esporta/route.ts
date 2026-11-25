import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/server/guard";

function csv(rows: string[][]) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return `\uFEFF${rows.map((row) => row.map(escape).join(";")).join("\r\n")}`;
}

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from("customers").select("*").order("last_name");
    if (error) return NextResponse.json({ errore: "Esportazione non riuscita." }, { status: 500 });
    const body = csv([
      ["Nome", "Cognome", "E-mail", "Telefono", "Note"],
      ...(data ?? []).map((row) => [row.first_name, row.last_name, row.email ?? "", row.phone ?? "", row.notes ?? ""]),
    ]);
    return new NextResponse(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=clienti-vc-hair-studio.csv",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
