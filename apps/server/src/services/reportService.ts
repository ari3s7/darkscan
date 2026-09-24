import { prisma } from "../prisma/client.js";
import { buildReport, type ComplianceReport } from "../report/buildReport.js";

export async function getScanReport(id: string): Promise<ComplianceReport | null> {
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: {
      pages: {
        include: {
          findings: {
            include: { evidence: true },
          },
        },
      },
      journeys: {
        include: { steps: { select: { id: true, pageId: true } } },
      },
    },
  });
  if (!scan) return null;

  return buildReport({
    scan: { id: scan.id, url: scan.url },
    aiAnalysis: scan.aiStatus ?? undefined,
    pages: scan.pages.map((page) => ({
      id: page.id,
      url: page.url,
      finalUrl: page.finalUrl,
      screenshotPath: page.screenshotPath,
    })),
    journeys: scan.journeys.map((journey) => ({
      id: journey.id,
      type: journey.type,
      status: journey.status,
      steps: journey.steps.map((step) => ({ id: step.id, pageId: step.pageId })),
    })),
    findings: scan.pages.flatMap((page) =>
      page.findings.map((finding) => ({
        id: finding.id,
        ruleId: finding.ruleId,
        source: finding.source,
        severity: finding.severity,
        summary: finding.summary,
        pageId: finding.pageId,
        journeyStepId: finding.journeyStepId,
        createdAt: finding.createdAt,
        evidence: finding.evidence.map((item) => ({
          id: item.id,
          type: item.type,
          content: item.content,
          createdAt: item.createdAt,
        })),
      })),
    ),
  });
}
