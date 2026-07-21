"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const STATUS_LABELS: Record<string, string> = {
  intake: "Aufnahme",
  antrag_vorbereitung: "Antrag in Vorbereitung",
  antrag_eingereicht: "Antrag eingereicht",
  eroeffnet: "Verfahren eröffnet",
  plan_phase: "Planphase",
  abgeschlossen: "Abgeschlossen",
  abgelehnt: "Abgelehnt",
};

const STATUS_COLORS: Record<string, string> = {
  intake: "#5B5F5A",
  antrag_vorbereitung: "#B08D57",
  antrag_eingereicht: "#8C6A3D",
  eroeffnet: "#3D5A3D",
  plan_phase: "#5C7A5C",
  abgeschlossen: "#14213D",
  abgelehnt: "#8C2F39",
};

export function MonthlyCasesChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#14213D" strokeOpacity={0.08} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5B5F5A" }} axisLine={{ stroke: "#14213D", strokeOpacity: 0.1 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#5B5F5A" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, border: "1px solid rgba(20,33,61,0.15)", borderRadius: 2 }}
          labelStyle={{ color: "#14213D", fontWeight: 600 }}
        />
        <Bar dataKey="count" name="Neue Akten" fill="#14213D" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDistributionChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="55%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#5B5F5A"} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, _name, props) => [value, STATUS_LABELS[props.payload.status] ?? props.payload.status]}
            contentStyle={{ fontSize: 12, border: "1px solid rgba(20,33,61,0.15)", borderRadius: 2 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-2 text-xs text-ink">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: STATUS_COLORS[d.status] ?? "#5B5F5A" }} />
            {STATUS_LABELS[d.status] ?? d.status} <span className="text-ash">({d.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
