import { WebClient } from '@slack/client';
import { loggerFromLoggingFunc } from '@slack/client/dist/logger';

const EMOJI = ':headphones:';

const getStatusText = (title, artist) => {
  const text = `${ title } - ${ artist }`;

  if (text.length < 100) {
    return text;
  }

  return `${ text.substr(0, 97) }...`;
}

const updateStatus = (title, artist) => {
  if (!Settings.get('slackToken')) {
    Logger.debug('No slack token set');
    return;
  }

  const client = new WebClient(Settings.get('slackToken'));
  const status = getStatusText(title, artist);

  try {
    client.users.profile.set({
      profile: {
        status_text: status,
        status_emoji: EMOJI,
      },
    }).then(result => {
      Logger.debug('Status updated on slack: ', result);
    }).catch(err => {
      Logger.error('Slack error: ', error);
    });;
  } catch( e ) {
    return Logger.error('Slack error: ', e);
  }
};

Emitter.on('change:track', (event, details) => {
  Logger.debug('Slack track change handler invoked');
  updateStatus(details.title, details.artist);
});
