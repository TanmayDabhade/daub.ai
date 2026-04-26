import WorkbenchView from "@/components/workbench/WorkbenchView";

export default async function WorkbenchTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return <WorkbenchView ticker={ticker} />;
}
