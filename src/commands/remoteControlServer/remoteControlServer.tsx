import { resolve } from 'path';
import { toString as qrToString } from 'qrcode';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { getBridgeAccessToken, isSelfHostedBridge } from '../../bridge/bridgeConfig.js';
import { createLocalRcsConfig, type LocalRcsConfig } from '../../bridge/localRcs.js';
import { getBridgeDisabledReason } from '../../bridge/bridgeEnabled.js';
import { BRIDGE_LOGIN_INSTRUCTION } from '../../bridge/types.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { ListItem } from '../../components/design-system/ListItem.js';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import { Box, Text } from '@anthropic/ink';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { buildCliLaunch, spawnCli } from '../../utils/cliLaunch.js';
import type { ToolUseContext } from '../../Tool.js';
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js';
import type { DaemonStateData } from '../../daemon/state.js';
import { queryDaemonStatus, stopDaemonByPid } from '../../daemon/state.js';
import { errorMessage } from '../../utils/errors.js';

type Props = {
  onDone: LocalJSXCommandOnDone;
};

function RemoteControlServer({ onDone }: Props): React.ReactNode {
  const [runningState, setRunningState] = useState<DaemonStateData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const current = queryDaemonStatus();
      if (current.status === 'running') {
        if (!cancelled) {
          setRunningState(current.state!);
        }
        return;
      }

      const useLocalRcs = !isSelfHostedBridge();
      const checkError = await checkPrerequisites(useLocalRcs);
      if (cancelled) return;
      if (checkError) {
        onDone(checkError, { display: 'system' });
        return;
      }

      try {
        const localRcs = await startDaemon(useLocalRcs);
        if (cancelled) return;
        onDone(buildStartedMessage(localRcs), { display: 'system' });
      } catch (err) {
        if (!cancelled) {
          onDone(`Remote Control Server failed to start: ${errorMessage(err)}`, {
            display: 'system',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onDone]);

  if (runningState) {
    return <ServerManagementDialog onDone={onDone} state={runningState} />;
  }

  return null;
}

function ServerManagementDialog({ onDone, state }: Props & { state: DaemonStateData }): React.ReactNode {
  useRegisterOverlay('remote-control-server-dialog');
  const [focusIndex, setFocusIndex] = useState(2);
  const [qrText, setQrText] = useState('');
  const webUrl = state.localRcs?.webUrl;

  useEffect(() => {
    if (!webUrl) {
      setQrText('');
      return;
    }
    qrToString(webUrl, {
      type: 'terminal',
      errorCorrectionLevel: 'L',
      small: true,
    })
      .then(setQrText)
      .catch(() => setQrText(''));
  }, [webUrl]);

  async function handleStop(): Promise<void> {
    const stopped = await stopDaemonByPid();
    onDone(stopped ? 'Remote Control Server stopped.' : 'Remote Control Server was not running.', {
      display: 'system',
    });
  }

  async function handleRestart(): Promise<void> {
    await stopDaemonByPid();
    try {
      const localRcs = await startDaemon(!isSelfHostedBridge());
      onDone(buildStartedMessage(localRcs, 'restarted'), { display: 'system' });
    } catch (err) {
      onDone(`Failed to restart: ${errorMessage(err)}`, { display: 'system' });
    }
  }

  function handleContinue(): void {
    onDone(undefined, { display: 'skip' });
  }

  const ITEM_COUNT = 3;
  const qrLines = qrText.split('\n').filter(line => line.length > 0);

  useKeybindings(
    {
      'select:next': () => setFocusIndex(i => (i + 1) % ITEM_COUNT),
      'select:previous': () => setFocusIndex(i => (i - 1 + ITEM_COUNT) % ITEM_COUNT),
      'select:accept': () => {
        if (focusIndex === 0) {
          void handleStop();
        } else if (focusIndex === 1) {
          void handleRestart();
        } else {
          handleContinue();
        }
      },
    },
    { context: 'Select' },
  );

  return (
    <Dialog title="Remote Control Server" onCancel={handleContinue} hideInputGuide>
      <Box flexDirection="column" gap={1}>
        <Text>
          Remote Control Server is{' '}
          <Text bold color="success">
            running
          </Text>{' '}
          (PID: {state.pid})
        </Text>
        <Text dimColor>Workers: {state.workerKinds.join(', ')}</Text>
        {webUrl && (
          <Box flexDirection="column">
            <Text>Open on phone: {webUrl}</Text>
            {qrLines.length > 0 && qrLines.map((line, i) => <Text key={i}>{line}</Text>)}
          </Box>
        )}
        <Box flexDirection="column">
          <ListItem isFocused={focusIndex === 0}>
            <Text>Stop server</Text>
          </ListItem>
          <ListItem isFocused={focusIndex === 1}>
            <Text>Restart server</Text>
          </ListItem>
          <ListItem isFocused={focusIndex === 2}>
            <Text>Continue</Text>
          </ListItem>
        </Box>
        <Text dimColor>Enter to select · Esc to continue</Text>
      </Box>
    </Dialog>
  );
}

async function checkPrerequisites(useLocalRcs: boolean): Promise<string | null> {
  if (useLocalRcs) {
    return null;
  }

  const disabledReason = await getBridgeDisabledReason();
  if (disabledReason) {
    return disabledReason;
  }

  if (!getBridgeAccessToken()) {
    return BRIDGE_LOGIN_INSTRUCTION;
  }

  return null;
}

async function startDaemon(useLocalRcs: boolean): Promise<LocalRcsConfig | null> {
  const dir = resolve('.');
  const localRcs = useLocalRcs ? await createLocalRcsConfig() : null;
  const args = ['daemon', 'start', `--dir=${dir}`];

  if (localRcs) {
    args.push(
      '--local-rcs',
      `--rcs-host=${localRcs.host}`,
      `--rcs-port=${localRcs.port}`,
      `--rcs-base-url=${localRcs.baseUrl}`,
      `--rcs-api-key=${localRcs.apiKey}`,
      `--rcs-pairing-token=${localRcs.pairingToken}`,
    );
  }

  const launch = buildCliLaunch(args);
  const child = spawnCli(launch, {
    cwd: dir,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  return localRcs;
}

function buildStartedMessage(localRcs: LocalRcsConfig | null, verb = 'started'): string {
  if (!localRcs) {
    return `Remote Control Server ${verb}. Use /remote-control-server to manage.`;
  }

  return [
    `Local Remote Control Server ${verb}.`,
    `Open on phone: ${localRcs.pairingUrl}`,
    'Phone and computer must be on the same LAN.',
    'Use /remote-control-server to manage or stop it.',
  ].join('\n');
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: ToolUseContext & LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  return <RemoteControlServer onDone={onDone} />;
}
