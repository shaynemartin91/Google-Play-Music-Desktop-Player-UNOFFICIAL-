// Pre-run
import chai from 'chai';
import chaiSinon from 'sinon-chai';
import sinon from 'sinon';
import WebSocket from 'ws';

// Test Classes
import Emitter from '../../build/main/utils/Emitter';
import PlaybackAPI from '../../build/main/utils/PlaybackAPI';

const expect = chai.expect;
chai.use(chaiSinon);
chai.should();

const INITIAL_DATA_COUNT = 13;

global.API_PORT = 4202; // Travis has something running on 5672

describe('WebSocketAPI', () => {
  before(() => {
    // Moch the required Settings API
    const _values = {};
    global.Settings = {
      get: (key, def) => {
        if (key === 'playbackAPI') {
          return true;
        }
        return _values[key] || def;
      },
      set: (key, value) => {
        _values[key] = value;
      },
      onChange: () => {},
      __TEST__: true,
    };
    // Moch the required WindowManager API
    global.WindowManager = {
      getAll: () => [],
    };
    // Moch the required Logger API
    global.Logger = {
      error: () => {},
    };
    global.Emitter = new Emitter();
    global.PlaybackAPI = new PlaybackAPI();
  });

  beforeEach(() => {
    global.PlaybackAPI.reset();
    require('../../build/main/features/core/websocketAPI');
  });

  it(`should start a WebSocket server on port ${global.API_PORT}`, (done) => {
    const ws = new WebSocket(`ws://localhost:${global.API_PORT}`);
    ws.on('open', done);
    ws.on('error', () => done(new Error('Failed to connect to the WebSocket')));
  });

  describe('when connected', () => {
    let ws;
    let spy;

    beforeEach(() => {
      ws = new WebSocket(`ws://localhost:${global.API_PORT}`);
      spy = sinon.spy();
    });

    const wait = (fn) =>
      (done) => {
        ws.on('open', () => {
          const checker = setInterval(() => {
            if (spy.callCount >= INITIAL_DATA_COUNT) {
              clearInterval(checker);
              try {
                fn(done);
              } catch (err) {
                done(err);
              }
            }
          }, 10);
        });
        ws.on('message', (msg) => spy(JSON.parse(msg)));
      };

    it('should send the API version on connect', wait((done) => {
      spy.getCall(0).args[0].channel.should.be.equal('API_VERSION');
      done();
    }));

    it('should send the player control states on connect', wait((done) => {
      spy.should.have.callCount(INITIAL_DATA_COUNT); // eslint-disable-line
      spy.getCall(1).args[0].channel.should.be.equal('playState');
      spy.getCall(2).args[0].channel.should.be.equal('shuffle');
      spy.getCall(3).args[0].channel.should.be.equal('repeat');
      spy.getCall(4).args[0].channel.should.be.equal('queue');
      spy.getCall(5).args[0].channel.should.be.equal('search-results');
      spy.getCall(6).args[0].channel.should.be.equal('volume');
      spy.getCall(7).args[0].channel.should.be.equal('track');
      spy.getCall(8).args[0].channel.should.be.equal('time');
      spy.getCall(9).args[0].channel.should.be.equal('lyrics');
      spy.getCall(10).args[0].channel.should.be.equal('rating');
      spy.getCall(11).args[0].channel.should.be.equal('playlists');
      spy.getCall(12).args[0].channel.should.be.equal('library');
      done();
    }));

    it('should send the correct initial player control values', wait((done) => {
      spy.should.have.callCount(INITIAL_DATA_COUNT); // eslint-disable-line
      // playState
      spy.getCall(1).args[0].payload.should.be.equal(false);
      // shuffle
      spy.getCall(2).args[0].payload.should.be.equal('NO_SHUFFLE');
      // repeat
      spy.getCall(3).args[0].payload.should.be.equal('NO_REPEAT');
      // queue
      spy.getCall(4).args[0].payload.should.be.deep.equal([]);
      // search-results
      spy.getCall(5).args[0].payload.should.be.deep.equal({
        searchText: '',
        albums: [],
        artists: [],
        tracks: [],
      });
      // volume
      spy.getCall(6).args[0].payload.should.be.equal(50);
      // track
      spy.getCall(7).args[0].payload.should.have.property('title');
      spy.getCall(7).args[0].payload.should.have.property('artist');
      spy.getCall(7).args[0].payload.should.have.property('album');
      expect(spy.getCall(7).args[0].payload.title).to.be.equal(null);
      expect(spy.getCall(7).args[0].payload.artist).to.be.equal(null);
      expect(spy.getCall(7).args[0].payload.album).to.be.equal(null);
      // time
      spy.getCall(8).args[0].payload.should.have.property('current');
      spy.getCall(8).args[0].payload.should.have.property('total');
      spy.getCall(8).args[0].payload.current.should.be.equal(0);
      spy.getCall(8).args[0].payload.total.should.be.equal(0);
      // lyrics
      expect(spy.getCall(9).args[0].payload).to.be.equal(null);
      // rating
      expect(spy.getCall(10).args[0].payload).to.be.deep.equal({ liked: false, disliked: false });
      // playlists
      spy.getCall(11).args[0].payload.should.be.deep.equal([]);
      // library
      spy.getCall(12).args[0].payload.should.be.deep.equal({
        albums: [],
        artists: [],
        tracks: [],
      });
      done();
    }));

    describe('when PlaybackAPI values change', () => {
      beforeEach((done) => {
        ws.on('open', () => {
          spy = sinon.spy();
          ws.on('message', (msg) => spy(JSON.parse(msg)));

          const checker = setInterval(() => {
            if (spy.callCount === INITIAL_DATA_COUNT) {
              spy = sinon.spy();
              ws.on('message', (msg) => spy(JSON.parse(msg)));
              clearInterval(checker);
              done();
            }
          }, 1);
        });
      });

      const waitForResponse = (tests) => {
        const i = spy.callCount;
        const checker = setInterval(() => {
          if (spy.callCount > i) {
            clearInterval(checker);
            tests();
          }
        }, 10);
      };

      const shouldUpdateTest = (channel, updateMethodName, newValueArgs, expectedValue) => {
        it(`should update the ${channel} value`, (done) => {
          if (Array.isArray(newValueArgs)) {
            global.PlaybackAPI[updateMethodName](...newValueArgs);
          } else {
            global.PlaybackAPI[updateMethodName](newValueArgs);
          }
          waitForResponse(() => {
            spy.getCall(0).args[0].channel.should.be.equal(channel);
            spy.getCall(0).args[0].payload.should.be.deep.equal(expectedValue || newValueArgs);
            done();
          });
        });
      };

      shouldUpdateTest('playState', '_setPlaying', true);
      shouldUpdateTest('shuffle', '_setShuffle', 'ALL_SHUFFLE');
      shouldUpdateTest('repeat', '_setRepeat', 'SINGLE_REPEAT');
      shouldUpdateTest('playlists', '_setPlaylists',
        [{ id: 1, name: 'TEST_PLAYLIST', tracks: [] }],
        { id: 1, name: 'TEST_PLAYLIST', tracks: [] }
      );
      shouldUpdateTest('queue', '_setQueue',
        [{ id: 1, title: 'Song 1' }],
        { id: 1, title: 'Song 1' }
      );
      shouldUpdateTest('search-results', '_setResults',
        {
          searchText: 'FOO_BAR',
          albums: [],
          artists: [],
          tracks: [],
        }
      );
      shouldUpdateTest('library', '_setLibrary',
        {
          albums: [],
          artists: [],
          tracks: [],
        }
      );
      shouldUpdateTest('volume', '_setVolume', 20);
      shouldUpdateTest('track', '_setPlaybackSong',
        ['songTitle', 'songArtist', 'songAlbum', 'songArt'],
        {
          title: 'songTitle',
          artist: 'songArtist',
          album: 'songAlbum',
          albumArt: 'songArt',
        });
      shouldUpdateTest('time', '_setTime', [100, 101], { current: 100, total: 101 });
      shouldUpdateTest('lyrics', '_setPlaybackSongLyrics', 'LA LA LA DOO WOP');
    });

    describe('when sending commands', () => {
      beforeEach((done) => {
        ws.on('open', () => {
          spy = sinon.spy();
          ws.on('message', (msg) => spy(JSON.parse(msg)));

          const checker = setInterval(() => {
            if (spy.callCount === INITIAL_DATA_COUNT) {
              spy = sinon.spy();
              ws.on('message', (msg) => spy(JSON.parse(msg)));
              clearInterval(checker);
              done();
            }
          }, 1);
        });
      });

      const playPauseCMD = JSON.stringify({ namespace: 'playback', method: 'playPause' });
      const connectCMD = JSON.stringify({ namespace: 'connect', method: 'connect', arguments: ['Test Device'] });
      const connectGoodCMD = JSON.stringify({ namespace: 'connect', method: 'connect', arguments: ['Test Device', '0000'] });
      const connectBadCMD = JSON.stringify({ namespace: 'connect', method: 'connect', arguments: ['Test Device', '1111'] });
      let permCode = false;

      it('should reject commands when not authoenticated', (done) => {
        ws.send(playPauseCMD);

        ws.once('message', (msg) => {
          const payload = JSON.parse(msg);
          payload.channel.should.be.equal('connect');
          payload.payload.should.be.equal('CODE_REQUIRED');
          done();
        });
      });

      it('should ask for a code when connecting and not authoenticated', (done) => {
        ws.send(connectCMD);

        ws.once('message', (msg) => {
          const payload = JSON.parse(msg);
          payload.channel.should.be.equal('connect');
          payload.payload.should.be.equal('CODE_REQUIRED');
          done();
        });
      });

      it('should ask for a code when connecting and not authenticated when sending an incorrect code', (done) => {
        ws.send(connectBadCMD);

        ws.once('message', (msg) => {
          const payload = JSON.parse(msg);
          payload.channel.should.be.equal('connect');
          payload.payload.should.be.equal('CODE_REQUIRED');
          done();
        });
      });

      it('should respond with a permenant code when connecting and not authenticated when sending a correct code', (done) => {
        ws.send(connectGoodCMD);

        ws.once('message', (msg) => {
          const payload = JSON.parse(msg);
          payload.channel.should.be.equal('connect');
          payload.payload.should.not.be.equal('CODE_REQUIRED');
          permCode = payload.payload;
          done();
        });
      });

      it('should not respond when connecting and not authenticated when sending a valid permenant code', (done) => {
        permCode.should.not.be.equal(false);
        ws.send(JSON.stringify({ namespace: 'connect', method: 'connect', arguments: ['Test Device', permCode] }));

        let msgRec = false;
        ws.once('message', () => {
          msgRec = true;
        });

        setTimeout(() => {
          msgRec.should.not.be.equal(true);
          done();
        }, 20);
      });

      it('should accept commands once authenticated', (done) => {
        permCode.should.not.be.equal(false);
        ws.send(JSON.stringify({ namespace: 'connect', method: 'connect', arguments: ['Test Device', permCode] }));
        ws.send(playPauseCMD);

        let msgRec = false;
        ws.once('message', () => {
          msgRec = true;
        });

        setTimeout(() => {
          msgRec.should.not.be.equal(true);
          done();
        }, 20);
      });
    });

    afterEach(() => {
      ws.close();
      ws = null;
    });
  });
});
