import { AssumptionChecks } from 'web';

export const SurvivalModelWarnings = () => (
  <div className="w-96">
    <AssumptionChecks
      warnings={[
        { type: 'ph_fail', severity: 'warning', message: 'Proportional hazards assumption violated', detail: 'The Cox PH test indicates non-proportional hazards. Hazard ratio may not be constant over time.' },
        { type: 'wide_ci', severity: 'info', message: 'Wide confidence interval', detail: 'The CI spans a large range, suggesting imprecise estimation.' },
        { type: 'low_events', severity: 'error', message: 'Only 7 events observed', detail: 'Survival estimates may be unreliable with fewer than 10 events.' },
      ]}
    />
  </div>
);

export const WithoutDetail = () => (
  <div className="w-96">
    <AssumptionChecks warnings={[{ type: 'small_n', severity: 'warning', message: 'Small sample size (n=42)' }]} />
  </div>
);
