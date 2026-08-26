export type AnalysisStage = "home" | "preview" | "analyzing" | "results" | "history";

export function shouldStartAnalysis(isPending: boolean, stage: AnalysisStage) {
  return !isPending && stage !== "analyzing";
}

export function isCurrentAnalysisRequest(activeRequestId: number, responseRequestId: number) {
  return activeRequestId === responseRequestId;
}
