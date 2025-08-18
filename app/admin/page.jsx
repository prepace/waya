"use client";
import { useMemo, useState } from "react";

function usd(n) {
	if (n === null || n === undefined || n === "") return "";
	const num = Number(n);
	if (!Number.isFinite(num)) return "";
	return num.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	});
}

function SumDeliverables(list) {
	if (!Array.isArray(list)) return 0;
	return list.reduce((a, d) => a + (Number(d?.value_usd) || 0), 0);
}

export default function AdminPage() {
	const [pw, setPw] = useState("");
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");
	const [q, setQ] = useState("");

	const load = async () => {
		setErr("");
		setLoading(true);
		try {
			const r = await fetch(`/api/admin?pw=${encodeURIComponent(pw)}`, {
				cache: "no-store",
			});
			const j = await r.json();
			if (!r.ok) throw new Error(j?.error || "Request failed");
			setRows(j.rows || []);
		} catch (e) {
			setErr(e.message || "Failed to load");
			setRows([]);
		} finally {
			setLoading(false);
		}
	};

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return rows;
		return rows.filter((r) =>
			[
				r.firstname,
				r.lastname,
				r.name,
				r.email,
				r.phone,
				r.task,
				r.status,
				r?.proposal?.title,
			]
				.filter(Boolean)
				.some((v) => String(v).toLowerCase().includes(term)),
		);
	}, [rows, q]);

	return (
		<main className="min-h-screen p-6 space-y-6">
			<header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold">Admin — Tasks & Results</h1>
					<p className="text-sm opacity-70">
						Enter password, load data, and browse nicely formatted proposals.
					</p>
				</div>

				<div className="flex gap-2">
					<input
						type="password"
						placeholder="Admin password"
						value={pw}
						onChange={(e) => setPw(e.target.value)}
						className="rounded-xl p-3 w-48"
						style={{
							background: "var(--background-contrast)",
							border: "1px solid var(--border-color)",
						}}
					/>
					<button
						type="button"
						onClick={load}
						className="rounded-xl px-4 h-11 font-medium"
						style={{
							background: "var(--button-bg)",
							color: "var(--button-fg)",
						}}
					>
						{loading ? "Loading…" : "Load"}
					</button>
				</div>
			</header>

			<div className="flex items-center gap-3">
				<input
					placeholder="Search name, email, task, title…"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					className="w-full sm:w-96 rounded-xl p-3"
					style={{
						background: "var(--background-contrast)",
						border: "1px solid var(--border-color)",
					}}
				/>
				{err && (
					<span className="text-sm" style={{ color: "#ef4444" }}>
						{err}
					</span>
				)}
			</div>

			{filtered.length === 0 && !loading && (
				<p className="opacity-70">
					No rows (try loading, check password, or clear search).
				</p>
			)}

			<section className="grid gap-4">
				{filtered.map((r) => {
					const p = r.proposal || {};
					const deliverables = p.deliverables_to_user || [];
					const sum = p.total_value_usd ?? SumDeliverables(deliverables);

					return (
						<article
							key={r.id}
							className="rounded-2xl p-5 space-y-4"
							style={{
								background: "var(--background-contrast)",
								border: "1px solid var(--border-color)",
							}}
						>
							{/* top row */}
							<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
								<div className="space-y-1">
									<div className="text-xs opacity-60">
										{r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}
									</div>
									<h2 className="text-lg font-semibold">
										{p.title || "(no proposal yet)"}
									</h2>
									<div className="text-sm opacity-80">
										<span className="font-medium">
											{r.name || `${r.firstname || ""} ${r.lastname || ""}`}
										</span>
										{r.email ? <> • {r.email}</> : null}
										{r.phone ? <> • {r.phone}</> : null}
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<span
										className="inline-flex items-center rounded-full px-3 h-8 text-sm"
										style={{
											background: "var(--overlay)",
											border: "1px solid var(--border-color)",
										}}
									>
										Worth: <strong className="ml-1">{usd(r.worth)}</strong>
									</span>
									{Number.isFinite(p.suggested_price_usd) && (
										<span
											className="inline-flex items-center rounded-full px-3 h-8 text-sm"
											style={{ background: "#0ea5e9", color: "white" }}
										>
											Suggested:{" "}
											<strong className="ml-1">
												{usd(p.suggested_price_usd)}
											</strong>
										</span>
									)}
									{Number.isFinite(sum) && (
										<span
											className="inline-flex items-center rounded-full px-3 h-8 text-sm"
											style={{ background: "#16a34a", color: "white" }}
										>
											Total Value: <strong className="ml-1">{usd(sum)}</strong>
										</span>
									)}
									{r.status && (
										<span
											className="inline-flex items-center rounded-full px-3 h-8 text-sm"
											style={{
												background: "var(--overlay)",
												border: "1px solid var(--border-color)",
											}}
										>
											Status: {r.status}
										</span>
									)}
								</div>
							</div>

							{/* task */}
							<div className="text-sm">
								<span className="font-semibold">Task:</span> {r.task}
							</div>

							{/* why + guarantee */}
							{(p.why_it_helps || p.guarantee) && (
								<div className="grid md:grid-cols-2 gap-4">
									{p.why_it_helps && (
										<div>
											<h3 className="font-semibold mb-1">Why it helps</h3>
											<p className="text-sm opacity-90">{p.why_it_helps}</p>
										</div>
									)}
									{p.guarantee && (
										<div>
											<h3 className="font-semibold mb-1">Guarantee</h3>
											<p className="text-sm">{p.guarantee}</p>
										</div>
									)}
								</div>
							)}

							{/* deliverables table */}
							{deliverables.length > 0 && (
								<div>
									<h3 className="font-semibold mb-2">Deliverables</h3>
									<div
										className="overflow-auto rounded-xl"
										style={{ border: "1px solid var(--border-color)" }}
									>
										<table className="min-w-[520px] w-full text-sm">
											<thead style={{ background: "var(--overlay)" }}>
												<tr>
													<th className="text-left p-2">Description</th>
													<th className="text-right p-2">Value</th>
												</tr>
											</thead>
											<tbody>
												{deliverables.map((d, i) => (
													<tr
														key={`${d.description}-${d.value_usd}-${i}`}
														className="border-t"
														style={{ borderColor: "var(--border-color)" }}
													>
														<td className="p-2">{d.description}</td>
														<td className="p-2 text-right">
															{usd(d.value_usd)}
														</td>
													</tr>
												))}
												<tr
													className="border-t font-semibold"
													style={{ borderColor: "var(--border-color)" }}
												>
													<td className="p-2 text-right">Total</td>
													<td className="p-2 text-right">{usd(sum)}</td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>
							)}

							{/* steps / success / risk / deps / time */}
							<div className="grid md:grid-cols-2 gap-4">
								{Array.isArray(p.steps_agent_will_do_today) &&
									p.steps_agent_will_do_today.length > 0 && (
										<div>
											<h3 className="font-semibold mb-1">Steps (today)</h3>
											<ul className="list-disc ml-5 text-sm space-y-1">
												{p.steps_agent_will_do_today.map((s, i) => (
													<li key={`step-${i}-${s.slice(0, 20)}`}>{s}</li>
												))}
											</ul>
										</div>
									)}
								{Array.isArray(p.success_criteria) &&
									p.success_criteria.length > 0 && (
										<div>
											<h3 className="font-semibold mb-1">Success Criteria</h3>
											<ul className="list-disc ml-5 text-sm space-y-1">
												{p.success_criteria.map((s, i) => (
													<li key={`success-${i}-${s.slice(0, 20)}`}>{s}</li>
												))}
											</ul>
										</div>
									)}
							</div>

							<div className="grid md:grid-cols-2 gap-4">
								{Array.isArray(p.risk_mitigation) &&
									p.risk_mitigation.length > 0 && (
										<div>
											<h3 className="font-semibold mb-1">Risk Mitigation</h3>
											<ul className="list-disc ml-5 text-sm space-y-1">
												{p.risk_mitigation.map((s, i) => (
													<li key={`risk-${i}-${s.slice(0, 20)}`}>{s}</li>
												))}
											</ul>
										</div>
									)}
								{Array.isArray(p.dependencies_or_access_needed) &&
									p.dependencies_or_access_needed.length > 0 && (
										<div>
											<h3 className="font-semibold mb-1">
												Dependencies / Access Needed
											</h3>
											<ul className="list-disc ml-5 text-sm space-y-1">
												{p.dependencies_or_access_needed.map((s, i) => (
													<li key={`dep-${i}-${s.slice(0, 20)}`}>{s}</li>
												))}
											</ul>
										</div>
									)}
							</div>

							<div className="text-sm opacity-80">
								<strong>Estimated Time Today:</strong>{" "}
								{p.est_time_hours_today ? `${p.est_time_hours_today}h` : "—"}
							</div>

							{r.quick_note_for_agent && (
								<div className="text-xs opacity-70">
									<strong>Agent Note:</strong> {r.quick_note_for_agent}
								</div>
							)}
						</article>
					);
				})}
			</section>
		</main>
	);
}
