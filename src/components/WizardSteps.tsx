export interface WizardStep {
  n: string;
  name: string;
  summary: string;
  state: "done" | "current" | "todo";
}

/** Left step list for focused flows. The current step has a 2px seal top rule. */
export function WizardSteps({ steps }: { steps: WizardStep[] }) {
  return (
    <ol
      className="steps"
      style={{ listStyle: "none", margin: 0, padding: 0 }}
      aria-label="Steps"
    >
      {steps.map((s) => (
        <li
          key={s.n}
          className={`step ${s.state}`}
          aria-current={s.state === "current" ? "step" : undefined}
        >
          <span className="n">{s.n}</span>
          <span className="step-main">
            <b>{s.name}</b>
            <span className="sum">{s.summary}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
