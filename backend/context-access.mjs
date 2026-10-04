// These backend-only closures cannot be forged through renderer/model JSON.
export const contextAccess=Symbol('backend-context-access');
export const recoveryFiles=Symbol('backend-reviewed-recovery-files');
export const assessmentContext=Symbol('backend-assessment-observer');
export function withContextAccess(task,check){return {...task,[contextAccess]:check};}
