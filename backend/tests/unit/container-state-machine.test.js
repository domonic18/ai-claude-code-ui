/**
 * ContainerStateMachine Tests
 *
 * Tests the container lifecycle state machine:
 * - State transitions (valid and invalid)
 * - Creation protection mechanism
 * - Force reset behavior
 * - State waiting with timeouts
 * - Event emission
 * - Serialization / deserialization (toJSON / fromJSON)
 * - State query methods (is, isStable, isTerminal)
 *
 * @module tests/unit/container-state-machine
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('ContainerStateMachine', () => {
  let ContainerStateMachine, ContainerState;

  beforeEach(async () => {
    const sm = await import('../../services/container/core/ContainerStateMachine.js');
    ContainerStateMachine = sm.ContainerStateMachine;
    ContainerState = sm.ContainerState;
  });

  // ── Module exports ──

  describe('Module exports', () => {
    it('should export ContainerStateMachine class', () => {
      assert.strictEqual(typeof ContainerStateMachine, 'function');
    });

    it('should export ContainerState enum', () => {
      assert.ok(ContainerState);
      assert.strictEqual(ContainerState.NON_EXISTENT, 'non_existent');
      assert.strictEqual(ContainerState.CREATING, 'creating');
      assert.strictEqual(ContainerState.STARTING, 'starting');
      assert.strictEqual(ContainerState.HEALTH_CHECKING, 'health_checking');
      assert.strictEqual(ContainerState.READY, 'ready');
      assert.strictEqual(ContainerState.STOPPING, 'stopping');
      assert.strictEqual(ContainerState.REMOVING, 'removing');
      assert.strictEqual(ContainerState.FAILED, 'failed');
      assert.strictEqual(ContainerState.DEAD, 'dead');
    });
  });

  // ── Constructor ──

  describe('Constructor', () => {
    it('should initialize with default state NON_EXISTENT', () => {
      const sm = new ContainerStateMachine();
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should initialize with custom userId and containerName', () => {
      const sm = new ContainerStateMachine({ userId: 42, containerName: 'test-ctr' });
      assert.strictEqual(sm.userId, 42);
      assert.strictEqual(sm.containerName, 'test-ctr');
    });

    it('should initialize with custom initial state', () => {
      const sm = new ContainerStateMachine({
        initialState: ContainerState.READY,
      });
      assert.strictEqual(sm.getState(), ContainerState.READY);
    });

    it('should initialize stateHistory with initial state', () => {
      const sm = new ContainerStateMachine();
      assert.deepStrictEqual(sm.stateHistory, [ContainerState.NON_EXISTENT]);
    });

    it('should set previousState to null', () => {
      const sm = new ContainerStateMachine();
      assert.strictEqual(sm.previousState, null);
    });

    it('should set error to null', () => {
      const sm = new ContainerStateMachine();
      assert.strictEqual(sm.error, null);
    });

    it('should set _isCreating to false', () => {
      const sm = new ContainerStateMachine();
      assert.strictEqual(sm.isCreating(), false);
    });
  });

  // ── State query methods ──

  describe('State query methods', () => {
    it('is() should return true for current state', () => {
      const sm = new ContainerStateMachine();
      assert.strictEqual(sm.is(ContainerState.NON_EXISTENT), true);
      assert.strictEqual(sm.is(ContainerState.READY), false);
    });

    it('isStable() should return true for stable states', () => {
      const stableStates = [
        ContainerState.NON_EXISTENT,
        ContainerState.READY,
        ContainerState.DEAD,
        ContainerState.FAILED,
      ];

      for (const state of stableStates) {
        const sm = new ContainerStateMachine({ initialState: state });
        assert.strictEqual(sm.isStable(), true, `${state} should be stable`);
      }
    });

    it('isStable() should return false for intermediate states', () => {
      const intermediateStates = [
        ContainerState.CREATING,
        ContainerState.STARTING,
        ContainerState.HEALTH_CHECKING,
        ContainerState.STOPPING,
        ContainerState.REMOVING,
      ];

      for (const state of intermediateStates) {
        const sm = new ContainerStateMachine({ initialState: state });
        assert.strictEqual(sm.isStable(), false, `${state} should not be stable`);
      }
    });

    it('isTerminal() should return true for terminal states', () => {
      const terminalStates = [
        ContainerState.NON_EXISTENT,
        ContainerState.DEAD,
        ContainerState.FAILED,
      ];

      for (const state of terminalStates) {
        const sm = new ContainerStateMachine({ initialState: state });
        assert.strictEqual(sm.isTerminal(), true, `${state} should be terminal`);
      }
    });

    it('isTerminal() should return false for non-terminal states', () => {
      const nonTerminalStates = [
        ContainerState.CREATING,
        ContainerState.STARTING,
        ContainerState.HEALTH_CHECKING,
        ContainerState.READY,
        ContainerState.STOPPING,
        ContainerState.REMOVING,
      ];

      for (const state of nonTerminalStates) {
        const sm = new ContainerStateMachine({ initialState: state });
        assert.strictEqual(sm.isTerminal(), false, `${state} should not be terminal`);
      }
    });
  });

  // ── Valid state transitions ──

  describe('Valid state transitions', () => {
    it('should transition NON_EXISTENT -> CREATING', () => {
      const sm = new ContainerStateMachine();
      const result = sm.transitionTo(ContainerState.CREATING);
      assert.strictEqual(result, true);
      assert.strictEqual(sm.getState(), ContainerState.CREATING);
    });

    it('should transition CREATING -> STARTING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      sm.transitionTo(ContainerState.STARTING);
      assert.strictEqual(sm.getState(), ContainerState.STARTING);
    });

    it('should transition CREATING -> FAILED', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      sm.transitionTo(ContainerState.FAILED);
      assert.strictEqual(sm.getState(), ContainerState.FAILED);
    });

    it('should transition STARTING -> HEALTH_CHECKING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.STARTING });
      sm.transitionTo(ContainerState.HEALTH_CHECKING);
      assert.strictEqual(sm.getState(), ContainerState.HEALTH_CHECKING);
    });

    it('should transition STARTING -> FAILED', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.STARTING });
      sm.transitionTo(ContainerState.FAILED);
      assert.strictEqual(sm.getState(), ContainerState.FAILED);
    });

    it('should transition HEALTH_CHECKING -> READY', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.HEALTH_CHECKING });
      sm.transitionTo(ContainerState.READY);
      assert.strictEqual(sm.getState(), ContainerState.READY);
    });

    it('should transition HEALTH_CHECKING -> FAILED', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.HEALTH_CHECKING });
      sm.transitionTo(ContainerState.FAILED);
      assert.strictEqual(sm.getState(), ContainerState.FAILED);
    });

    it('should transition READY -> STOPPING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      sm.transitionTo(ContainerState.STOPPING);
      assert.strictEqual(sm.getState(), ContainerState.STOPPING);
    });

    it('should transition READY -> REMOVING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      sm.transitionTo(ContainerState.REMOVING);
      assert.strictEqual(sm.getState(), ContainerState.REMOVING);
    });

    it('should transition READY -> FAILED', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      sm.transitionTo(ContainerState.FAILED);
      assert.strictEqual(sm.getState(), ContainerState.FAILED);
    });

    it('should transition READY -> NON_EXISTENT', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      sm.transitionTo(ContainerState.NON_EXISTENT);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should transition STOPPING -> DEAD', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.STOPPING });
      sm.transitionTo(ContainerState.DEAD);
      assert.strictEqual(sm.getState(), ContainerState.DEAD);
    });

    it('should transition REMOVING -> NON_EXISTENT', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.REMOVING });
      sm.transitionTo(ContainerState.NON_EXISTENT);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should transition FAILED -> REMOVING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.FAILED });
      sm.transitionTo(ContainerState.REMOVING);
      assert.strictEqual(sm.getState(), ContainerState.REMOVING);
    });

    it('should transition FAILED -> NON_EXISTENT', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.FAILED });
      sm.transitionTo(ContainerState.NON_EXISTENT);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should transition DEAD -> REMOVING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.DEAD });
      sm.transitionTo(ContainerState.REMOVING);
      assert.strictEqual(sm.getState(), ContainerState.REMOVING);
    });

    it('should transition DEAD -> NON_EXISTENT', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.DEAD });
      sm.transitionTo(ContainerState.NON_EXISTENT);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should allow self-transition', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      sm.transitionTo(ContainerState.READY);
      assert.strictEqual(sm.getState(), ContainerState.READY);
    });
  });

  // ── Invalid state transitions ──

  describe('Invalid state transitions', () => {
    it('should throw on NON_EXISTENT -> READY', () => {
      const sm = new ContainerStateMachine();
      assert.throws(
        () => sm.transitionTo(ContainerState.READY),
        (err) => err.message.includes('Invalid state transition')
      );
    });

    it('should throw on NON_EXISTENT -> STOPPING', () => {
      const sm = new ContainerStateMachine();
      assert.throws(
        () => sm.transitionTo(ContainerState.STOPPING),
        (err) => err.message.includes('Invalid state transition')
      );
    });

    it('should throw on READY -> CREATING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      assert.throws(
        () => sm.transitionTo(ContainerState.CREATING),
        (err) => err.message.includes('Invalid state transition')
      );
    });

    it('should throw on CREATING -> READY (skip steps)', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      assert.throws(
        () => sm.transitionTo(ContainerState.READY),
        (err) => err.message.includes('Invalid state transition')
      );
    });

    it('should throw on DEAD -> READY', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.DEAD });
      assert.throws(
        () => sm.transitionTo(ContainerState.READY),
        (err) => err.message.includes('Invalid state transition')
      );
    });

    it('should throw on STOPPING -> CREATING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.STOPPING });
      assert.throws(
        () => sm.transitionTo(ContainerState.CREATING),
        (err) => err.message.includes('Invalid state transition')
      );
    });

    it('should throw on unknown state', () => {
      const sm = new ContainerStateMachine();
      assert.throws(
        () => sm.transitionTo('unknown_state'),
        (err) => err.message.includes('Invalid state transition')
      );
    });
  });

  // ── Full lifecycle ──

  describe('Full container lifecycle', () => {
    it('should complete happy path: NON_EXISTENT -> CREATING -> STARTING -> HEALTH_CHECKING -> READY', () => {
      const sm = new ContainerStateMachine();
      sm.transitionTo(ContainerState.CREATING);
      sm.transitionTo(ContainerState.STARTING);
      sm.transitionTo(ContainerState.HEALTH_CHECKING);
      sm.transitionTo(ContainerState.READY);

      assert.strictEqual(sm.getState(), ContainerState.READY);
      assert.strictEqual(sm.isStable(), true);
      assert.strictEqual(sm.isTerminal(), false);
    });

    it('should complete stop path: READY -> STOPPING -> DEAD', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      sm.transitionTo(ContainerState.STOPPING);
      sm.transitionTo(ContainerState.DEAD);

      assert.strictEqual(sm.getState(), ContainerState.DEAD);
      assert.strictEqual(sm.isTerminal(), true);
    });

    it('should complete remove path: READY -> REMOVING -> NON_EXISTENT', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      sm.transitionTo(ContainerState.REMOVING);
      sm.transitionTo(ContainerState.NON_EXISTENT);

      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should complete fail-and-recover: CREATING -> FAILED -> NON_EXISTENT -> CREATING', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      sm.transitionTo(ContainerState.FAILED);
      assert.strictEqual(sm.getState(), ContainerState.FAILED);

      sm.transitionTo(ContainerState.NON_EXISTENT);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);

      sm.transitionTo(ContainerState.CREATING);
      assert.strictEqual(sm.getState(), ContainerState.CREATING);
    });
  });

  // ── Transition side effects ──

  describe('Transition side effects', () => {
    it('should update previousState on transition', () => {
      const sm = new ContainerStateMachine();
      sm.transitionTo(ContainerState.CREATING);
      assert.strictEqual(sm.previousState, ContainerState.NON_EXISTENT);
    });

    it('should append to stateHistory on each transition', () => {
      const sm = new ContainerStateMachine();
      sm.transitionTo(ContainerState.CREATING);
      sm.transitionTo(ContainerState.STARTING);

      assert.deepStrictEqual(sm.stateHistory, [
        ContainerState.NON_EXISTENT,
        ContainerState.CREATING,
        ContainerState.STARTING,
      ]);
    });

    it('should update lastTransitionTime on each transition', async () => {
      const sm = new ContainerStateMachine();
      const before = sm.lastTransitionTime;

      // Small delay to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 5));
      sm.transitionTo(ContainerState.CREATING);

      assert.ok(sm.lastTransitionTime > before);
    });

    it('should emit stateChanged event with correct data', () => {
      const sm = new ContainerStateMachine({ userId: 1, containerName: 'test' });
      const events = [];

      sm.on('stateChanged', (data) => events.push(data));

      sm.transitionTo(ContainerState.CREATING);

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].from, ContainerState.NON_EXISTENT);
      assert.strictEqual(events[0].to, ContainerState.CREATING);
      assert.strictEqual(events[0].userId, 1);
      assert.strictEqual(events[0].containerName, 'test');
      assert.ok(events[0].timestamp instanceof Date);
    });

    it('should pass metadata in stateChanged event', () => {
      const sm = new ContainerStateMachine();
      const events = [];

      sm.on('stateChanged', (data) => events.push(data));

      sm.transitionTo(ContainerState.CREATING, { reason: 'user request' });

      assert.strictEqual(events[0].metadata.reason, 'user request');
    });

    it('should clear error when transitioning to non-FAILED state', () => {
      const sm = new ContainerStateMachine();
      sm.error = new Error('Previous error');

      sm.transitionTo(ContainerState.CREATING);

      assert.strictEqual(sm.error, null);
    });

    it('should not clear error when transitioning to FAILED state', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      const err = new Error('Creation failed');
      sm.setFailed(err);

      assert.strictEqual(sm.error, err);
      assert.strictEqual(sm.getState(), ContainerState.FAILED);
    });
  });

  // ── setFailed() ──

  describe('setFailed()', () => {
    it('should set error and transition to FAILED', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      const error = new Error('Docker build failed');
      sm.setFailed(error);

      assert.strictEqual(sm.getState(), ContainerState.FAILED);
      assert.strictEqual(sm.error, error);
    });

    it('should include error message in metadata', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.STARTING });
      const events = [];
      sm.on('stateChanged', (data) => events.push(data));

      sm.setFailed(new Error('Timeout'));

      assert.strictEqual(events[0].metadata.error, 'Timeout');
    });
  });

  // ── Creation protection ──

  describe('Creation protection', () => {
    it('should set _isCreating=true when transitioning to CREATING', () => {
      const sm = new ContainerStateMachine();
      sm.transitionTo(ContainerState.CREATING);
      assert.strictEqual(sm.isCreating(), true);
    });

    it('should clear _isCreating when leaving CREATING state', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      sm.transitionTo(ContainerState.STARTING);
      assert.strictEqual(sm.isCreating(), false);
    });

    it('beginCreation() should set _isCreating=true', () => {
      const sm = new ContainerStateMachine();
      sm.beginCreation();
      assert.strictEqual(sm.isCreating(), true);
    });

    it('endCreation() should set _isCreating=false', () => {
      const sm = new ContainerStateMachine();
      sm.beginCreation();
      sm.endCreation();
      assert.strictEqual(sm.isCreating(), false);
    });
  });

  // ── forceReset() ──

  describe('forceReset()', () => {
    it('should reset to NON_EXISTENT when not creating', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      const result = sm.forceReset();

      assert.strictEqual(result, true);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should not reset when _isCreating flag is set via transition', () => {
      const sm = new ContainerStateMachine();
      // Transition to CREATING which sets _isCreating=true
      sm.transitionTo(ContainerState.CREATING);
      const result = sm.forceReset();

      assert.strictEqual(result, false);
      assert.strictEqual(sm.getState(), ContainerState.CREATING);
    });

    it('should reset when initialState is CREATING (no _isCreating flag)', () => {
      // Constructor sets initialState but does NOT set _isCreating flag
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      // forceReset should succeed because _isCreating is false
      const result = sm.forceReset();
      assert.strictEqual(result, true);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });

    it('should not reset when beginCreation() was called', () => {
      const sm = new ContainerStateMachine();
      sm.beginCreation();
      const result = sm.forceReset();

      assert.strictEqual(result, false);
    });

    it('should emit stateChanged event with forced metadata', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      const events = [];
      sm.on('stateChanged', (data) => events.push(data));

      sm.forceReset();

      assert.strictEqual(events[0].metadata.forced, true);
    });

    it('should clear error on forceReset', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.FAILED });
      sm.error = new Error('some error');

      sm.forceReset();

      assert.strictEqual(sm.error, null);
    });

    it('should reset after creation ends', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      sm.endCreation();
      const result = sm.forceReset();

      assert.strictEqual(result, true);
      assert.strictEqual(sm.getState(), ContainerState.NON_EXISTENT);
    });
  });

  // ── waitForState() ──

  describe('waitForState()', () => {
    it('should resolve immediately if already in target state', async () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      const result = await sm.waitForState(ContainerState.READY, { timeout: 100 });
      assert.strictEqual(result, ContainerState.READY);
    });

    it('should resolve when state transitions to target', async () => {
      // Start from CREATING (non-terminal) and wait for READY
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      const promise = sm.waitForState(ContainerState.READY, { timeout: 2000 });

      // Simulate transitions
      setTimeout(() => sm.transitionTo(ContainerState.STARTING), 10);
      setTimeout(() => sm.transitionTo(ContainerState.HEALTH_CHECKING), 30);
      setTimeout(() => sm.transitionTo(ContainerState.READY), 50);

      const result = await promise;
      assert.strictEqual(result, ContainerState.READY);
    });

    it('should reject on timeout', async () => {
      // Start from CREATING (non-terminal) so it actually waits
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      // Wait for READY but never transition - should timeout
      await assert.rejects(
        sm.waitForState(ContainerState.READY, { timeout: 50 }),
        (err) => err.message.includes('Timeout waiting for state')
      );
    });

    it('should return current state if in terminal state', async () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.FAILED });
      const result = await sm.waitForState(ContainerState.READY, { timeout: 100 });
      assert.strictEqual(result, ContainerState.FAILED);
    });

    it('should accept array of target states', async () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      const promise = sm.waitForState(
        [ContainerState.READY, ContainerState.FAILED],
        { timeout: 2000 }
      );

      setTimeout(() => sm.transitionTo(ContainerState.FAILED), 10);

      const result = await promise;
      assert.strictEqual(result, ContainerState.FAILED);
    });
  });

  // ── waitForStable() ──

  describe('waitForStable()', () => {
    it('should resolve immediately if in stable state', async () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.READY });
      const result = await sm.waitForStable({ timeout: 100 });
      assert.strictEqual(result, ContainerState.READY);
    });

    it('should resolve when reaching FAILED state', async () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      const promise = sm.waitForStable({ timeout: 2000 });

      setTimeout(() => sm.transitionTo(ContainerState.FAILED), 10);

      const result = await promise;
      assert.strictEqual(result, ContainerState.FAILED);
    });
  });

  // ── getInfo() ──

  describe('getInfo()', () => {
    it('should return complete state info', () => {
      const sm = new ContainerStateMachine({ userId: 42, containerName: 'ctr-1' });
      sm.transitionTo(ContainerState.CREATING);

      const info = sm.getInfo();

      assert.strictEqual(info.userId, 42);
      assert.strictEqual(info.containerName, 'ctr-1');
      assert.strictEqual(info.currentState, ContainerState.CREATING);
      assert.strictEqual(info.previousState, ContainerState.NON_EXISTENT);
      assert.ok(Array.isArray(info.stateHistory));
      assert.strictEqual(typeof info.isStable, 'boolean');
      assert.strictEqual(typeof info.isTerminal, 'boolean');
      assert.strictEqual(info.error, null);
    });

    it('should include error message when error is set', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      sm.setFailed(new Error('test error'));

      const info = sm.getInfo();
      assert.strictEqual(info.error, 'test error');
    });
  });

  // ── toJSON() ──

  describe('toJSON()', () => {
    it('should serialize state machine to plain object', () => {
      const sm = new ContainerStateMachine({ userId: 1, containerName: 'test' });
      const json = sm.toJSON();

      assert.strictEqual(json.userId, 1);
      assert.strictEqual(json.containerName, 'test');
      assert.strictEqual(json.currentState, ContainerState.NON_EXISTENT);
      assert.ok(Array.isArray(json.stateHistory));
      assert.strictEqual(typeof json.lastTransitionTime, 'string');
      assert.strictEqual(json.error, null);
    });

    it('should include error message when error is set', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      sm.setFailed(new Error('build failed'));

      const json = sm.toJSON();
      assert.strictEqual(json.error, 'build failed');
    });
  });

  // ── fromJSON() ──

  describe('fromJSON()', () => {
    it('should restore state machine from serialized data', () => {
      const original = new ContainerStateMachine({ userId: 5, containerName: 'restored' });
      original.transitionTo(ContainerState.CREATING);
      original.transitionTo(ContainerState.STARTING);
      original.transitionTo(ContainerState.HEALTH_CHECKING);
      original.transitionTo(ContainerState.READY);

      const json = original.toJSON();
      const restored = ContainerStateMachine.fromJSON(json);

      assert.strictEqual(restored.userId, 5);
      assert.strictEqual(restored.containerName, 'restored');
      assert.strictEqual(restored.getState(), ContainerState.READY);
      assert.deepStrictEqual(restored.stateHistory, json.stateHistory);
    });

    it('should reset intermediate states to NON_EXISTENT', () => {
      const intermediateStates = [
        ContainerState.CREATING,
        ContainerState.STARTING,
        ContainerState.HEALTH_CHECKING,
      ];

      for (const state of intermediateStates) {
        const data = {
          userId: 1,
          containerName: 'test',
          currentState: state,
          stateHistory: [ContainerState.NON_EXISTENT, state],
          lastTransitionTime: new Date().toISOString(),
          error: null,
        };

        const restored = ContainerStateMachine.fromJSON(data);
        assert.strictEqual(
          restored.getState(),
          ContainerState.NON_EXISTENT,
          `${state} should be reset to NON_EXISTENT`
        );
      }
    });

    it('should preserve stable states', () => {
      const stableStates = [
        ContainerState.NON_EXISTENT,
        ContainerState.READY,
        ContainerState.DEAD,
        ContainerState.FAILED,
      ];

      for (const state of stableStates) {
        const data = {
          userId: 1,
          containerName: 'test',
          currentState: state,
          stateHistory: [state],
          lastTransitionTime: new Date().toISOString(),
          error: null,
        };

        const restored = ContainerStateMachine.fromJSON(data);
        assert.strictEqual(
          restored.getState(),
          state,
          `${state} should be preserved`
        );
      }
    });

    it('should restore error from serialized data', () => {
      const data = {
        userId: 1,
        containerName: 'test',
        currentState: ContainerState.FAILED,
        stateHistory: [ContainerState.NON_EXISTENT, ContainerState.FAILED],
        lastTransitionTime: new Date().toISOString(),
        error: 'Something went wrong',
      };

      const restored = ContainerStateMachine.fromJSON(data);
      assert.ok(restored.error instanceof Error);
      assert.strictEqual(restored.error.message, 'Something went wrong');
    });

    it('should use default stateHistory if not provided', () => {
      const data = {
        userId: 1,
        containerName: 'test',
        currentState: ContainerState.READY,
        lastTransitionTime: new Date().toISOString(),
        error: null,
      };

      const restored = ContainerStateMachine.fromJSON(data);
      assert.deepStrictEqual(restored.stateHistory, [ContainerState.READY]);
    });
  });

  // ── getError() ──

  describe('getError()', () => {
    it('should return null when no error', () => {
      const sm = new ContainerStateMachine();
      assert.strictEqual(sm.getError(), null);
    });

    it('should return error after setFailed()', () => {
      const sm = new ContainerStateMachine({ initialState: ContainerState.CREATING });
      const err = new Error('fail');
      sm.setFailed(err);
      assert.strictEqual(sm.getError(), err);
    });
  });
});
