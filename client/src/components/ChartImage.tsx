import type { Chart } from "../types";

interface Props {
  chart: Chart;
}

export function ChartImage({ chart }: Props) {
  const src = `data:${chart.mime};base64,${chart.data_base64}`;
  return (
    <figure className="chart">
      <img src={src} alt={chart.title} loading="lazy" />
      <figcaption>{chart.title}</figcaption>
    </figure>
  );
}
