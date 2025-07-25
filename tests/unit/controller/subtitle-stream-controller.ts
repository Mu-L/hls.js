import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { State } from '../../../src/controller/base-stream-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { SubtitleStreamController } from '../../../src/controller/subtitle-stream-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import KeyLoader from '../../../src/loader/key-loader';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';

chai.use(sinonChai);
const expect = chai.expect;

const mediaMock = {
  currentTime: 0,
  addEventListener() {},
  removeEventListener() {},
};

const tracksMock = [
  {
    id: 0,
    details: { url: '', fragments: [] },
    attrs: new AttrList({}),
  },
  {
    id: 1,
    attrs: new AttrList({}),
  },
];

describe('SubtitleStreamController', function () {
  let hls;
  let fragmentTracker;
  let keyLoader;
  let subtitleStreamController;

  beforeEach(function () {
    hls = new Hls({});
    mediaMock.currentTime = 0;
    fragmentTracker = new FragmentTracker(hls);
    keyLoader = new KeyLoader(hls.config);

    subtitleStreamController = new SubtitleStreamController(
      hls,
      fragmentTracker,
      keyLoader,
    );

    subtitleStreamController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: mediaMock,
    });
    subtitleStreamController.state = State.IDLE;
  });

  afterEach(function () {
    subtitleStreamController.onMediaDetaching(Events.MEDIA_DETACHING, {
      media: mediaMock,
    });
    hls.destroy();
  });

  describe('onSubtitleTracksUpdate', function () {
    beforeEach(function () {
      hls.trigger(Events.SUBTITLE_TRACKS_UPDATED, {
        subtitleTracks: tracksMock,
      });
    });

    it('should update tracks list', function () {
      expect(subtitleStreamController.levels).to.have.lengthOf(2);
      expect(subtitleStreamController.levels[0]).to.deep.include(tracksMock[0]);
      expect(subtitleStreamController.levels[1]).to.deep.include(tracksMock[1]);
    });
  });

  describe('onSubtitleTrackSwitch', function () {
    beforeEach(function () {
      subtitleStreamController.levels = tracksMock;
      subtitleStreamController.clearInterval = sinon.spy();
      subtitleStreamController.setInterval = sinon.spy();

      hls.trigger(Events.SUBTITLE_TRACK_SWITCH, {
        id: 0,
      });
    });

    it('should call setInterval if details available', function () {
      expect(subtitleStreamController.setInterval).to.have.been.calledOnce;
    });

    it('should call clearInterval if no tracks present', function () {
      subtitleStreamController.levels = [];
      hls.trigger(Events.SUBTITLE_TRACK_SWITCH, {
        id: 0,
      });
      expect(subtitleStreamController.clearInterval).to.have.been.calledOnce;
    });

    it('should call clearInterval if new track id === -1', function () {
      hls.trigger(Events.SUBTITLE_TRACK_SWITCH, {
        id: -1,
      });
      expect(subtitleStreamController.clearInterval).to.have.been.calledOnce;
    });
  });

  describe('onSubtitleTrackLoaded', function () {
    beforeEach(function () {
      subtitleStreamController.setInterval = sinon.spy();
      subtitleStreamController.levels = tracksMock;
    });

    // Details are in subtitle-track-controller.js' onSubtitleTrackLoaded handler
    it('should handle the event if the data matches the current track', function () {
      const details = { foo: 'bar', fragments: [] };
      subtitleStreamController.currentTrackId = 1;
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
        id: 1,
        details: details,
      });
      expect(subtitleStreamController.levels[1].details).to.equal(details);
    });

    it('should ignore the event if the data does not match the current track', function () {
      const details = { foo: 'bar', fragments: [] };
      subtitleStreamController.currentTrackId = 0;
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
        id: 1,
        details,
      });
      expect(subtitleStreamController.levels[0].details).to.not.equal(details);
      expect(subtitleStreamController.setInterval).to.not.have.been.called;
    });

    it('should ignore the event if there are no tracks, or the id is not within the tracks array', function () {
      subtitleStreamController.levels = [];
      subtitleStreamController.trackId = 0;
      const details = { foo: 'bar', fragments: [] };
      hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
        id: 0,
        details,
      });
      expect(subtitleStreamController.levels[0]).to.not.exist;
      expect(subtitleStreamController.setInterval).to.not.have.been.called;
    });
  });

  describe('onMediaSeeking', function () {
    it('nulls fragPrevious when seeking away from fragCurrent', function () {
      subtitleStreamController.fragCurrent = new Fragment(
        PlaylistLevelType.MAIN,
        '',
      );
      subtitleStreamController.fragCurrent.start = 1000;
      subtitleStreamController.fragCurrent.duration = 10;
      subtitleStreamController.fragPrevious = new Fragment(
        PlaylistLevelType.MAIN,
        '',
      );
      subtitleStreamController.onMediaSeeking();
      expect(subtitleStreamController.fragPrevious).to.not.exist;
    });
  });
});
