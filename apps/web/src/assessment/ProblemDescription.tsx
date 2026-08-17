import type { AssessmentProblemView } from "./types.js";

export interface ProblemDescriptionProps {
  problem: AssessmentProblemView;
}

export function ProblemDescription({ problem }: ProblemDescriptionProps) {
  return (
    <article className="problem-description">
      <div className="problem-heading">
        <span className="question-kicker">Question {problem.slot}</span>
        <h1>{problem.title}</h1>
        <p className="complexity-chip">
          Target {problem.generationMetadata.expectedComplexity}
        </p>
      </div>

      <section>
        <h2>Task</h2>
        <p>{problem.description}</p>
      </section>

      <section>
        <h2>Examples</h2>
        {problem.examples.map((example, index) => (
          <div className="example-card" key={`${problem.id}-example-${index}`}>
            <div>
              <span>Input</span>
              <code>{formatValue(example.arguments)}</code>
            </div>
            <div>
              <span>Output</span>
              <code>{formatValue(example.output)}</code>
            </div>
            <p>{example.explanation}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Constraints</h2>
        <ul className="constraint-list">
          {problem.constraints.map((constraint) => (
            <li key={constraint}>
              <code>{constraint}</code>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Skills</h2>
        <div className="skill-list">
          {problem.generationMetadata.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </section>
    </article>
  );
}

function formatValue(value: unknown): string {
  return JSON.stringify(value);
}
