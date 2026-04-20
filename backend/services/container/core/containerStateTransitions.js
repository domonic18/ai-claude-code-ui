/**
 * Container State Transitions
 * ==========================
 *
 * State transition definitions and validation for container state machine.
 * Extracted from ContainerStateMachine.js to reduce complexity.
 *
 * @module container/core/containerStateTransitions
 */

/**
 * Container state enumeration
 */
export const ContainerState = {
  /** Container does not exist */
  NON_EXISTENT: 'non_existent',
  /** Container is being created */
  CREATING: 'creating',
  /** Container created, starting up */
  STARTING: 'starting',
  /** Container starting up, health check in progress */
  HEALTH_CHECKING: 'health_checking',
  /** Container ready for use */
  READY: 'ready',
  /** Container is stopping */
  STOPPING: 'stopping',
  /** Container is being removed */
  REMOVING: 'removing',
  /** Creation or execution failed */
  FAILED: 'failed',
  /** Container stopped and will not restart */
  DEAD: 'dead'
};

/**
 * Valid state transitions
 * source -> [target states]
 */
export const VALID_TRANSITIONS = {
  [ContainerState.NON_EXISTENT]: [
    ContainerState.CREATING
  ],
  [ContainerState.CREATING]: [
    ContainerState.STARTING,
    ContainerState.FAILED
  ],
  [ContainerState.STARTING]: [
    ContainerState.HEALTH_CHECKING,
    ContainerState.FAILED
  ],
  [ContainerState.HEALTH_CHECKING]: [
    ContainerState.READY,
    ContainerState.FAILED
  ],
  [ContainerState.READY]: [
    ContainerState.STOPPING,
    ContainerState.REMOVING,
    ContainerState.FAILED,
    ContainerState.NON_EXISTENT
  ],
  [ContainerState.STOPPING]: [
    ContainerState.DEAD,
    ContainerState.FAILED
  ],
  [ContainerState.REMOVING]: [
    ContainerState.NON_EXISTENT,
    ContainerState.FAILED
  ],
  [ContainerState.FAILED]: [
    ContainerState.REMOVING,
    ContainerState.NON_EXISTENT
  ],
  [ContainerState.DEAD]: [
    ContainerState.REMOVING,
    ContainerState.NON_EXISTENT
  ]
};

/**
 * Terminal states (cannot transition further)
 */
export const TERMINAL_STATES = new Set([
  ContainerState.NON_EXISTENT,
  ContainerState.DEAD,
  ContainerState.FAILED
]);

/**
 * Stable states (can remain long-term)
 */
export const STABLE_STATES = new Set([
  ContainerState.NON_EXISTENT,
  ContainerState.READY,
  ContainerState.DEAD,
  ContainerState.FAILED
]);

/**
 * Validate if a state transition is allowed
 *
 * @param {string} currentState - Current state
 * @param {string} targetState - Target state
 * @returns {boolean} Whether transition is valid
 */
export function canTransitionTo(currentState, targetState) {
  if (currentState === targetState) {
    return true; // Allow self-transition
  }

  const validTargets = VALID_TRANSITIONS[currentState];
  return validTargets?.includes(targetState) || false;
}

/**
 * Check if state is a terminal state
 *
 * @param {string} state - State to check
 * @returns {boolean} Whether state is terminal
 */
export function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

/**
 * Check if state is a stable state
 *
 * @param {string} state - State to check
 * @returns {boolean} Whether state is stable
 */
export function isStableState(state) {
  return STABLE_STATES.has(state);
}

/**
 * Get intermediate states that should be reset after server restart
 *
 * @returns {string[]} Array of intermediate states
 */
export function getIntermediateStates() {
  return [
    ContainerState.CREATING,
    ContainerState.STARTING,
    ContainerState.HEALTH_CHECKING
  ];
}
