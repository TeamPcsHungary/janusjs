/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
/* global mozRTCIceCandidate, mozRTCPeerConnection,
mozRTCSessionDescription, webkitRTCPeerConnection */
/* exported trace,requestUserMedia */

/*
 *  Edge support provided thanks to the adaptation devised by SimpleWebRTC
 *
 * 		https://simplewebrtc.com/bundle-edge.js
 *
 */

//~ 'use strict';

var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;

function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}

function maybeFixConfiguration(pcConfig) {
  if (!pcConfig) {
    return;
  }
  for (var i = 0; i < pcConfig.iceServers.length; i++) {
    if (pcConfig.iceServers[i].hasOwnProperty('urls')) {
      pcConfig.iceServers[i].url = pcConfig.iceServers[i].urls;
      delete pcConfig.iceServers[i].urls;
    }
  }
}

if (navigator.mozGetUserMedia) {
  // console.log('This appears to be Firefox');

  webrtcDetectedBrowser = 'firefox';

  webrtcDetectedVersion =
    parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

  // The RTCPeerConnection object.
  if (!(RTCPeerConnection = window.RTCPeerConnection)) {
    RTCPeerConnection = function(pcConfig, pcConstraints) {
      // .urls is not supported in FF yet.
      maybeFixConfiguration(pcConfig);
      return new mozRTCPeerConnection(pcConfig, pcConstraints);
    };
  }

  // The RTCSessionDescription object.
  if (!window.RTCSessionDescription) {
    window.RTCSessionDescription = mozRTCSessionDescription;
  }

  // The RTCIceCandidate object.
  if (!window.RTCIceCandidate) {
    window.RTCIceCandidate = mozRTCIceCandidate;
  }

  // getUserMedia shim (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.mozGetUserMedia.bind(navigator);
  navigator.getUserMedia = getUserMedia;

  // Shim for MediaStreamTrack.getSources.
  MediaStreamTrack.getSources = function(successCb) {
    setTimeout(function() {
      var infos = [
        { kind: 'audio', id: 'default', label:'', facing:'' },
        { kind: 'video', id: 'default', label:'', facing:'' }
      ];
      successCb(infos);
    }, 0);
  };

  // Creates ICE server from the URL for FF.
  window.createIceServer = function(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create ICE server with STUN URL.
      iceServer = {
        'url': url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      if (webrtcDetectedVersion < 27) {
        // Create iceServer with turn url.
        // Ignore the transport parameter from TURN url for FF version <=27.
        var turnUrlParts = url.split('?');
        // Return null for createIceServer if transport=tcp.
        if (turnUrlParts.length === 1 ||
          turnUrlParts[1].indexOf('transport=udp') === 0) {
          iceServer = {
            'url': turnUrlParts[0],
            'credential': password,
            'username': username
          };
        }
      } else {
        // FF 27 and above supports transport parameters in TURN url,
        // So passing in the full url to create iceServer.
        iceServer = {
          'url': url,
          'credential': password,
          'username': username
        };
      }
    }
    return iceServer;
  };

  window.createIceServers = function(urls, username, password) {
    var iceServers = [];
    // Use .url for FireFox.
    for (var i = 0; i < urls.length; i++) {
      var iceServer =
        window.createIceServer(urls[i], username, password);
      if (iceServer !== null) {
        iceServers.push(iceServer);
      }
    }
    return iceServers;
  };

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    // console.log('Attaching media stream');
    if (webrtcDetectedVersion < 58) {
      element.mozSrcObject = stream;
    } else {
      element.srcObject = stream;
    }
  };

  reattachMediaStream = function(to, from) {
    // console.log('Reattaching media stream');
    if (webrtcDetectedVersion < 58) {
      to.mozSrcObject = from.mozSrcObject;
    } else {
      to.srcObject = from.srcObject;
    }
  };

} else if (navigator.webkitGetUserMedia) {
  // console.log('This appears to be Chrome');

  webrtcDetectedBrowser = 'chrome';
  // Temporary fix until crbug/374263 is fixed.
  // Setting Chrome version to 999, if version is unavailable.
  var result = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
  if (result !== null) {
    webrtcDetectedVersion = parseInt(result[2], 10);
  } else {
    webrtcDetectedVersion = 999;
  }

  // Creates iceServer from the url for Chrome M33 and earlier.
  window.createIceServer = function(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = {
        'url': url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      // Chrome M28 & above uses below TURN format.
      iceServer = {
        'url': url,
        'credential': password,
        'username': username
      };
    }
    return iceServer;
  };

  // Creates an ICEServer object from multiple URLs.
  window.createIceServers = function(urls, username, password) {
    return {
      'urls': urls,
      'credential': password,
      'username': username
    };
  };

  // The RTCPeerConnection object.
  RTCPeerConnection = function(pcConfig, pcConstraints) {
    return new webkitRTCPeerConnection(pcConfig, pcConstraints);
  };

  // Get UserMedia (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
  navigator.getUserMedia = getUserMedia;

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    if (typeof element.srcObject !== 'undefined') {
      element.srcObject = stream;
    } else if (typeof element.mozSrcObject !== 'undefined') {
      element.mozSrcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = URL.createObjectURL(stream);
    } else {
      // console.log('Error attaching stream to element.');
    }
  };

  reattachMediaStream = function(to, from) {
    to.src = from.src;
  };
} else if (navigator.mediaDevices && navigator.userAgent.match(
    /Edge\/(\d+).(\d+)$/)) {
  // console.log('This appears to be Edge');
  webrtcDetectedBrowser = 'edge';

  webrtcDetectedVersion =
    parseInt(navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)[2], 10);

  // the minimum version still supported by adapter.
  webrtcMinimumVersion = 10525;

  // getUserMedia has no prefix in Edge
  getUserMedia = navigator.getUserMedia.bind(navigator);
  navigator.getUserMedia = getUserMedia;

  // Shim for MediaStreamTrack.getSources.
  MediaStreamTrack.getSources = function(successCb) {
    setTimeout(function() {
      var infos = [
        { kind: 'audio', id: 'default', label:'', facing:'' },
        { kind: 'video', id: 'default', label:'', facing:'' }
      ];
      successCb(infos);
    }, 0);
  };

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    // console.log('Attaching media stream');
    element.srcObject = stream;
  };

  reattachMediaStream = function(to, from) {
    // console.log('Reattaching media stream');
    to.srcObject = from.srcObject;
  };

  if (RTCIceGatherer) {
    window.RTCIceCandidate = function(args) {
      return args;
    };
    window.RTCSessionDescription = function(args) {
      return args;
    };

    window.RTCPeerConnection = function(config) {
      var self = this;

      this.onicecandidate = null;
      this.onaddstream = null;
      this.onremovestream = null;
      this.onsignalingstatechange = null;
      this.oniceconnectionstatechange = null;
      this.onnegotiationneeded = null;
      this.ondatachannel = null;

      this.localStreams = [];
      this.remoteStreams = [];
      this.getLocalStreams = function() { return self.localStreams; };
      this.getRemoteStreams = function() { return self.remoteStreams; };

      this.localDescription = new RTCSessionDescription({
        type: '',
        sdp: ''
      });
      this.remoteDescription = new RTCSessionDescription({
        type: '',
        sdp: ''
      });
      this.signalingState = 'stable';
      this.iceConnectionState = 'new';

      this.iceOptions = {
        gatherPolicy: 'all',
        iceServers: []
      };
      if (config && config.iceTransportPolicy) {
        switch (config.iceTransportPolicy) {
        case 'all':
        case 'relay':
          this.iceOptions.gatherPolicy = config.iceTransportPolicy;
          break;
        case 'none':
          console.warn('can not map iceTransportPolicy none,' +
              'falling back to "all"');
          break;
        }
      }
      //~ if (config && config.iceServers) {
        //~ // Make sure urls is used (http://ortc.org/wp-content/uploads/2015/06/ortc.html#idl-def-RTCIceServer)
        //~ for (var i = 0; i < config.iceServers.length; i++) {
          //~ if (config.iceServers[i].hasOwnProperty('url')) {
            //~ config.iceServers[i].urls = config.iceServers[i].url;
            //~ delete config.iceServers[i].url;
          //~ }
        //~ }
        //~ this.iceOptions.iceServers = config.iceServers;
        //~ this.iceOptions.iceServers.urls = this.iceOptions.iceServers.url;
      //~ }

      // per-track iceGathers etc
      this.tracks = [];

      this._iceCandidates = [];

      this._peerConnectionId = 'PC_' + Math.floor(Math.random() * 65536);

      // FIXME: Should be generated according to spec (guid?)
      // and be the same for all PCs from the same JS
      this._cname = Math.random().toString(36).substr(2, 10);
    };

    window.RTCPeerConnection.prototype.addStream = function(stream) {
      // clone just in case we're working in a local demo
      // FIXME: seems to be fixed
      this.localStreams.push(stream.clone());

      // FIXME: maybe trigger negotiationneeded?
    };

    window.RTCPeerConnection.prototype.removeStream = function(stream) {
      var idx = this.localStreams.indexOf(stream);
      if (idx > -1) {
        this.localStreams.splice(idx, 1);
      }
      // FIXME: maybe trigger negotiationneeded?
    };

    // SDP helper from sdp-jingle-json with modifications.
    window.RTCPeerConnection.prototype._toCandidateJSON = function(line) {
      var parts;
      if (line.indexOf('a=candidate:') === 0) {
        parts = line.substring(12).split(' ');
      } else { // no a=candidate
        parts = line.substring(10).split(' ');
      }

      var candidate = {
        foundation: parts[0],
        component: parts[1],
        protocol: parts[2].toLowerCase(),
        priority: parseInt(parts[3], 10),
        ip: parts[4],
        port: parseInt(parts[5], 10),
        // skip parts[6] == 'typ'
        type: parts[7]
        //generation: '0'
      };

      for (var i = 8; i < parts.length; i += 2) {
        if (parts[i] === 'raddr') {
          candidate.relatedAddress = parts[i + 1]; // was: relAddr
        } else if (parts[i] === 'rport') {
          candidate.relatedPort = parseInt(parts[i + 1], 10); // was: relPort
        } else if (parts[i] === 'generation') {
          candidate.generation = parts[i + 1];
        } else if (parts[i] === 'tcptype') {
          candidate.tcpType = parts[i + 1];
        }
      }
      return candidate;
    };

    // SDP helper from sdp-jingle-json with modifications.
    window.RTCPeerConnection.prototype._toCandidateSDP = function(candidate) {
      var sdp = [];
      sdp.push(candidate.foundation);
      sdp.push(candidate.component);
      sdp.push(candidate.protocol.toUpperCase());
      sdp.push(candidate.priority);
      sdp.push(candidate.ip);
      sdp.push(candidate.port);

      var type = candidate.type;
      sdp.push('typ');
      sdp.push(type);
      if (type === 'srflx' || type === 'prflx' || type === 'relay') {
        if (candidate.relatedAddress && candidate.relatedPort) {
          sdp.push('raddr');
          sdp.push(candidate.relatedAddress); // was: relAddr
          sdp.push('rport');
          sdp.push(candidate.relatedPort); // was: relPort
        }
      }
      if (candidate.tcpType && candidate.protocol.toUpperCase() === 'TCP') {
        sdp.push('tcptype');
        sdp.push(candidate.tcpType);
      }
      return 'a=candidate:' + sdp.join(' ');
    };

    // SDP helper from sdp-jingle-json with modifications.
    window.RTCPeerConnection.prototype._parseRtpMap = function(line) {
      var parts = line.substr(9).split(' ');
      var parsed = {
        payloadType: parseInt(parts.shift(), 10) // was: id
      };

      parts = parts[0].split('/');

      parsed.name = parts[0];
      parsed.clockRate = parseInt(parts[1], 10); // was: clockrate
      parsed.numChannels = parts.length === 3 ? parseInt(parts[2], 10) : 1; // was: channels
      return parsed;
    };

    // Parses SDP to determine capabilities.
    window.RTCPeerConnection.prototype._getRemoteCapabilities =
        function(section) {
      var remoteCapabilities = {
        codecs: [],
        headerExtensions: [],
        fecMechanisms: []
      };
      var i;
      var lines = section.split('\r\n');
      var mline = lines[0].substr(2).split(' ');
      var rtpmapFilter = function(line) {
        return line.indexOf('a=rtpmap:' + mline[i]) === 0;
      };
      var fmtpFilter = function(line) {
        return line.indexOf('a=fmtp:' + mline[i]) === 0;
      };
      var parseFmtp = function(line) {
        var parsed = {};
        var kv;
        var parts = line.substr(('a=fmtp:' + mline[i]).length + 1).split(';');
        for (var j = 0; j < parts.length; j++) {
          kv = parts[j].split('=');
          parsed[kv[0].trim()] = kv[1];
        }
        // console.log('fmtp', mline[i], parsed);
        return parsed;
      };
      var rtcpFbFilter = function(line) {
        return line.indexOf('a=rtcp-fb:' + mline[i]) === 0;
      };
      var parseRtcpFb = function(line) {
        var parts = line.substr(('a=rtcp-fb:' + mline[i]).length + 1)
            .split(' ');
        return {
          type: parts.shift(),
          parameter: parts.join(' ')
        };
      };
      for (i = 3; i < mline.length; i++) { // find all codecs from mline[3..]
        var line = lines.filter(rtpmapFilter)[0];
        if (line) {
          var codec = this._parseRtpMap(line);
          // Don't add codecs we know WebRTC browsers don't support
          if(codec.name.toLowerCase() !== "opus" &&
              codec.name.toLowerCase() !== "pcma" &&
              codec.name.toLowerCase() !== "pcmu" &&
              codec.name.toLowerCase() !== "h264" &&
              codec.name.toLowerCase() !== "x-h264uc" &&
              codec.name.toLowerCase() !== "vp8")
            continue;
          var fmtp = lines.filter(fmtpFilter);
          codec.parameters = fmtp.length ? parseFmtp(fmtp[0]) : {};
          codec.rtcpFeedback = lines.filter(rtcpFbFilter).map(parseRtcpFb);

          remoteCapabilities.codecs.push(codec);
        }
      }
      return remoteCapabilities;
    };

    // Serializes capabilities to SDP.
    window.RTCPeerConnection.prototype._capabilitiesToSDP = function(caps) {
      var sdp = '';
      caps.codecs.forEach(function(codec) {
        var pt = codec.payloadType;
        if (codec.preferredPayloadType !== undefined) {
          pt = codec.preferredPayloadType;
        }
        sdp += 'a=rtpmap:' + pt +
            ' ' + codec.name +
            '/' + codec.clockRate +
            (codec.numChannels !== 1 ? '/' + codec.numChannels : '') +
            '\r\n';
        if (codec.parameters && codec.parameters.length) {
          sdp += 'a=ftmp:' + pt + ' ';
          Object.keys(codec.parameters).forEach(function(param) {
            sdp += param + '=' + codec.parameters[param];
          });
          sdp += '\r\n';
        }
        if (codec.rtcpFeedback) {
          // FIXME: special handling for trr-int?
          codec.rtcpFeedback.forEach(function(fb) {
            sdp += 'a=rtcp-fb:' + pt + ' ' + fb.type + ' ' +
                fb.parameter + '\r\n';
          });
        }
      });
      return sdp;
    };

    // Calculates the intersection of local and remote capabilities.
    window.RTCPeerConnection.prototype._getCommonCapabilities =
        function(localCapabilities, remoteCapabilities) {
      // console.warn(localCapabilities);
      // console.warn(remoteCapabilities);
      var commonCapabilities = {
        codecs: [],
        headerExtensions: [],
        fecMechanisms: []
      };
      localCapabilities.codecs.forEach(function(lCodec) {
        for (var i = 0; i < remoteCapabilities.codecs.length; i++) {
          var rCodec = remoteCapabilities.codecs[i];
          //~ if(rCodec.name.toLowerCase() === "h264")
            //~ rCodec.name = "X-H264UC";	// Ugly attempt to make H264 negotiation work
          if (lCodec.name.toLowerCase() === rCodec.name.toLowerCase() &&
              lCodec.clockRate === rCodec.clockRate &&
              lCodec.numChannels === rCodec.numChannels) {
            // push rCodec so we reply with offerer payload type
            commonCapabilities.codecs.push(rCodec);

            // FIXME: also need to calculate intersection between
            // .rtcpFeedback and .parameters
            break;
          }
        }
      });

      localCapabilities.headerExtensions.forEach(function(lHeaderExtension) {
        for (var i = 0; i < remoteCapabilities.headerExtensions.length; i++) {
          var rHeaderExtension = remoteCapabilities.headerExtensions[i];
          if (lHeaderExtension.uri === rHeaderExtension.uri) {
            commonCapabilities.headerExtensions.push(rHeaderExtension);
            break;
          }
        }
      });

      // FIXME: fecMechanisms
      return commonCapabilities;
    };

    // Parses DTLS parameters from SDP section or sessionpart.
    window.RTCPeerConnection.prototype._getDtlsParameters =
        function(section, session) {
      var lines = section.split('\r\n');
      lines = lines.concat(session.split('\r\n')); // Search in session part, too.
      var fpLine = lines.filter(function(line) {
        return line.indexOf('a=fingerprint:') === 0;
      });
      fpLine = fpLine[0].substr(14);
      var dtlsParameters = {
        role: 'auto',
        fingerprints: [{
          algorithm: fpLine.split(' ')[0],
          value: fpLine.split(' ')[1]
        }]
      };
      return dtlsParameters;
    };

    // Serializes DTLS parameters to SDP.
    window.RTCPeerConnection.prototype._dtlsParametersToSDP =
        function(params, setupType) {
      var sdp = 'a=setup:' + setupType + '\r\n';
      params.fingerprints.forEach(function(fp) {
        sdp += 'a=fingerprint:' + fp.algorithm + ' ' + fp.value + '\r\n';
      });
      return sdp;
    };

    // Parses ICE information from SDP section or sessionpart.
    window.RTCPeerConnection.prototype._getIceParameters =
        function(section, session) {
      var lines = section.split('\r\n');
      lines = lines.concat(session.split('\r\n')); // Search in session part, too.
      var iceParameters = {
        usernameFragment: lines.filter(function(line) {
          return line.indexOf('a=ice-ufrag:') === 0;
        })[0].substr(12),
        password: lines.filter(function(line) {
          return line.indexOf('a=ice-pwd:') === 0;
        })[0].substr(10),
      };
      return iceParameters;
    };

    // Serializes ICE parameters to SDP.
    window.RTCPeerConnection.prototype._iceParametersToSDP = function(params) {
      return 'a=ice-ufrag:' + params.usernameFragment + '\r\n' +
          'a=ice-pwd:' + params.password + '\r\n';
    };

    window.RTCPeerConnection.prototype._getEncodingParameters = function(ssrc) {
      return {
        ssrc: ssrc,
        codecPayloadType: 0,
        fec: 0,
        rtx: 0,
        priority: 1.0,
        maxBitrate: 2000000.0,
        minQuality: 0,
        framerateBias: 0.5,
        resolutionScale: 1.0,
        framerateScale: 1.0,
        active: true,
        dependencyEncodingId: undefined,
        encodingId: undefined
      };
    };

    // Create ICE gatherer, ICE transport and DTLS transport.
    window.RTCPeerConnection.prototype._createIceAndDtlsTransports =
        function(mid, sdpMLineIndex) {
      var self = this;
      var iceGatherer = new RTCIceGatherer(self.iceOptions);
      var iceTransport = new RTCIceTransport(iceGatherer);
      iceGatherer.onlocalcandidate = function(evt) {
        var event = {};
        event.candidate = {sdpMid: mid, sdpMLineIndex: sdpMLineIndex};

        var cand = evt.candidate;
        var isEndOfCandidates = !(cand && Object.keys(cand).length > 0);
        if (isEndOfCandidates) {
          event.candidate.candidate =
              'candidate:1 1 udp 1 0.0.0.0 9 typ endOfCandidates';
        } else {
          // RTCIceCandidate doesn't have a component, needs to be added
          cand.component = iceTransport.component === 'RTCP' ? 2 : 1;
          event.candidate.candidate = self._toCandidateSDP(cand);
        }
        if (self.onicecandidate !== null) {
          if (self.localDescription && self.localDescription.type === '') {
            self._iceCandidates.push(event);
          } else {
            self.onicecandidate(event);
          }
        }
      };
      iceTransport.onicestatechange = function() {
        // console.log(self._peerConnectionId,
        //     'ICE state change', iceTransport.state);
        self._updateIceConnectionState(iceTransport.state);
      };

      var dtlsTransport = new RTCDtlsTransport(iceTransport);
      dtlsTransport.ondtlsstatechange = function() {
        /*
        console.log(self._peerConnectionId, sdpMLineIndex,
            'dtls state change', dtlsTransport.state);
        */
      };
      dtlsTransport.onerror = function(error) {
        console.error('dtls error', error);
      };
      return {
        iceGatherer: iceGatherer,
        iceTransport: iceTransport,
        dtlsTransport: dtlsTransport
      };
    };

    window.RTCPeerConnection.prototype.setLocalDescription =
        function(description) {
      var self = this;
      if (description.type === 'offer') {
        if (!description.ortc) {
          // FIXME: throw?
        } else {
          this.tracks = description.ortc;
        }
      } else if (description.type === 'answer') {
        var sections = self.remoteDescription.sdp.split('\r\nm=');
        var sessionpart = sections.shift();
        sections.forEach(function(section, sdpMLineIndex) {
          section = 'm=' + section;

          var iceGatherer = self.tracks[sdpMLineIndex].iceGatherer;
          var iceTransport = self.tracks[sdpMLineIndex].iceTransport;
          var dtlsTransport = self.tracks[sdpMLineIndex].dtlsTransport;
          var rtpSender = self.tracks[sdpMLineIndex].rtpSender;
          var localCapabilities =
              self.tracks[sdpMLineIndex].localCapabilities;
          var remoteCapabilities =
              self.tracks[sdpMLineIndex].remoteCapabilities;
          var sendSSRC = self.tracks[sdpMLineIndex].sendSSRC;
          var recvSSRC = self.tracks[sdpMLineIndex].recvSSRC;

          for(var c in self.tracks[sdpMLineIndex].remoteCandidates) {
            var candidate = self.tracks[sdpMLineIndex].remoteCandidates[c];
            self.addIceCandidate(candidate);
          }

          var remoteIceParameters = self._getIceParameters(section,
              sessionpart);
          iceTransport.start(iceGatherer, remoteIceParameters, 'controlled');

          var remoteDtlsParameters = self._getDtlsParameters(section,
              sessionpart);
          dtlsTransport.start(remoteDtlsParameters);

          if (rtpSender) {
            // calculate intersection of capabilities
            var params = self._getCommonCapabilities(localCapabilities,
                remoteCapabilities);
            params.muxId = sendSSRC;
            params.encodings = [self._getEncodingParameters(sendSSRC)];
            params.rtcp = {
              cname: self._cname,
              reducedSize: false,
              ssrc: recvSSRC,
              mux: true
            };
            rtpSender.send(params);
          }
        });
      }

      this.localDescription = description;
      switch (description.type) {
      case 'offer':
        this._updateSignalingState('have-local-offer');
        break;
      case 'answer':
        this._updateSignalingState('stable');
        break;
      }

      // FIXME: need to _reliably_ execute after args[1] or promise
      window.setTimeout(function() {
        // FIXME: need to apply ice candidates in a way which is async but in-order
        self._iceCandidates.forEach(function(event) {
          if (self.onicecandidate !== null) {
            self.onicecandidate(event);
          }
        });
        self._iceCandidates = [];
      }, 50);
      if (arguments.length > 1 && typeof arguments[1] === 'function') {
        window.setTimeout(arguments[1], 0);
      }
      return new Promise(function(resolve) {
        resolve();
      });
    };

    window.RTCPeerConnection.prototype.setRemoteDescription =
        function(description) {
      // FIXME: for type=offer this creates state. which should not
      //  happen before SLD with type=answer but... we need the stream
      //  here for onaddstream.
      var self = this;
      var sections = description.sdp.split('\r\nm=');
      var sessionpart = sections.shift();
      var stream = new MediaStream();
      sections.forEach(function(section, sdpMLineIndex) {
        section = 'm=' + section;
        var lines = section.split('\r\n');
        var mline = lines[0].substr(2).split(' ');
        var kind = mline[0];
        var line;

        var iceGatherer;
        var iceTransport;
        var dtlsTransport;
        var rtpSender;
        var rtpReceiver;
        var sendSSRC;
        var recvSSRC;

        var mid = lines.filter(function(line) {
          return line.indexOf('a=mid:') === 0;
        })[0].substr(6);

        var cname;

        var remoteCapabilities;
        var params;

        if (description.type === 'offer') {
          var transports = self._createIceAndDtlsTransports(mid, sdpMLineIndex);

          var localCapabilities = RTCRtpReceiver.getCapabilities(kind);
          // determine remote caps from SDP
          remoteCapabilities = self._getRemoteCapabilities(section);

          line = lines.filter(function(line) {
            return line.indexOf('a=ssrc:') === 0 &&
                line.split(' ')[1].indexOf('cname:') === 0;
          });
          sendSSRC = (2 * sdpMLineIndex + 2) * 1001;
          if (line) { // FIXME: alot of assumptions here
            recvSSRC = line[0].split(' ')[0].split(':')[1];
            cname = line[0].split(' ')[1].split(':')[1];
          }
          rtpReceiver = new RTCRtpReceiver(transports.dtlsTransport, kind);

          // calculate intersection so no unknown caps get passed into the RTPReciver
          params = self._getCommonCapabilities(localCapabilities,
              remoteCapabilities);

          params.muxId = recvSSRC;
          params.encodings = [self._getEncodingParameters(recvSSRC)];
          params.rtcp = {
            cname: cname,
            reducedSize: false,
            ssrc: sendSSRC,
            mux: true
          };
          // console.warn("rtpReceiver:",params);
          rtpReceiver.receive(params);
          // FIXME: not correct when there are multiple streams but that is
          // not currently supported.
          stream.addTrack(rtpReceiver.track);

          // FIXME: honor a=sendrecv
          if (self.localStreams.length > 0 &&
              self.localStreams[0].getTracks().length >= sdpMLineIndex) {
            // FIXME: actually more complicated, needs to match types etc
            var localtrack = self.localStreams[0].getTracks()[sdpMLineIndex];
            rtpSender = new RTCRtpSender(localtrack, transports.dtlsTransport);
          }

          self.tracks[sdpMLineIndex] = {
            iceGatherer: transports.iceGatherer,
            iceTransport: transports.iceTransport,
            dtlsTransport: transports.dtlsTransport,
            localCapabilities: localCapabilities,
            remoteCapabilities: remoteCapabilities,
            rtpSender: rtpSender,
            rtpReceiver: rtpReceiver,
            kind: kind,
            mid: mid,
            sendSSRC: sendSSRC,
            recvSSRC: recvSSRC,
            remoteCandidates: []
          };
        } else {
          iceGatherer = self.tracks[sdpMLineIndex].iceGatherer;
          iceTransport = self.tracks[sdpMLineIndex].iceTransport;
          dtlsTransport = self.tracks[sdpMLineIndex].dtlsTransport;
          rtpSender = self.tracks[sdpMLineIndex].rtpSender;
          rtpReceiver = self.tracks[sdpMLineIndex].rtpReceiver;
          sendSSRC = self.tracks[sdpMLineIndex].sendSSRC;
          recvSSRC = self.tracks[sdpMLineIndex].recvSSRC;
        }

        var remoteIceParameters = self._getIceParameters(section, sessionpart);
        var remoteDtlsParameters = self._getDtlsParameters(section,
            sessionpart);

        // There may be candidates listed in the SDP
        var candidatesFilter = function(line) {
          return line.indexOf('a=candidate:') === 0;
        };
        var candidates = lines.filter(candidatesFilter);
        if(candidates.length) {
          for(var i=0; i<candidates.length; i++) {
            var candidate = { candidate: candidates[i].substr(2), sdpMid: kind, sdpMLineIndex: sdpMLineIndex };
            self.tracks[sdpMLineIndex].remoteCandidates.push(candidate);
          }
          var lastCandidate = { candidate: 'candidate:1 1 udp 1 0.0.0.0 9 typ endOfCandidates', sdpMid: kind, sdpMLineIndex: sdpMLineIndex };
          self.tracks[sdpMLineIndex].remoteCandidates.push(lastCandidate);
        }

        // for answers we start ice and dtls here, otherwise this is done in SLD
        if (description.type === 'answer') {
          for(var c in self.tracks[sdpMLineIndex].remoteCandidates) {
            var candidate = self.tracks[sdpMLineIndex].remoteCandidates[c];
            self.addIceCandidate(candidate);
          }

          iceTransport.start(iceGatherer, remoteIceParameters, 'controlling');
          dtlsTransport.start(remoteDtlsParameters);

          // determine remote caps from SDP
          remoteCapabilities = self._getRemoteCapabilities(section);
          // FIXME: store remote caps?

          // FIXME: only if a=sendrecv
          var bidi = lines.filter(function(line) {
            return line.indexOf('a=ssrc:') === 0;
          }).length > 0;
          if (rtpReceiver && bidi) {
            line = lines.filter(function(line) {
              return line.indexOf('a=ssrc:') === 0 &&
                  line.split(' ')[1].indexOf('cname:') === 0;
            });
            if (line) { // FIXME: alot of assumptions here
              recvSSRC = line[0].split(' ')[0].split(':')[1];
              cname = line[0].split(' ')[1].split(':')[1];
            }
            params = remoteCapabilities;
            params.muxId = recvSSRC;
            params.encodings = [self._getEncodingParameters(recvSSRC)];
            params.rtcp = {
              cname: cname,
              reducedSize: false,
              ssrc: sendSSRC,
              mux: true
            };
            // console.warn("rtpReceiver:", params, kind);
            rtpReceiver.receive(params, kind);
            stream.addTrack(rtpReceiver.track);
            self.tracks[sdpMLineIndex].recvSSRC = recvSSRC;
          }
          if (rtpSender) {
            params = remoteCapabilities;
            params.muxId = sendSSRC;
            params.encodings = [self._getEncodingParameters(sendSSRC)];
            params.rtcp = {
              cname: self._cname,
              reducedSize: false,
              ssrc: recvSSRC,
              mux: true
            };
            // console.warn("rtpSender:",params);
            rtpSender.send(params);
          }

        }
      });

      this.remoteDescription = description;
      switch (description.type) {
      case 'offer':
        this._updateSignalingState('have-remote-offer');
        break;
      case 'answer':
        this._updateSignalingState('stable');
        break;
      }
      window.setTimeout(function() {
        if (self.onaddstream !== null && stream.getTracks().length) {
          window.setTimeout(function() {
            self.onaddstream({stream: stream});
          }, 0);
        }
      }, 0);
      if (arguments.length > 1 && typeof arguments[1] === 'function') {
        window.setTimeout(arguments[1], 0);
      }
      return new Promise(function(resolve) {
        resolve();
      });
    };

    window.RTCPeerConnection.prototype.close = function() {
      this.tracks.forEach(function(track) {
        /* not yet
        if (track.iceGatherer) {
          track.iceGatherer.close();
        }
        */
        if (track.iceTransport) {
          track.iceTransport.stop();
        }
        if (track.dtlsTransport) {
          track.dtlsTransport.stop();
        }
        if (track.rtpSender) {
          track.rtpSender.stop();
        }
        if (track.rtpReceiver) {
          track.rtpReceiver.stop();
        }
      });
      // FIXME: clean up tracks, local streams, remote streams, etc
      this._updateSignalingState('closed');
      this._updateIceConnectionState('closed');
    };

    // Update the signaling state.
    window.RTCPeerConnection.prototype._updateSignalingState =
        function(newState) {
      this.signalingState = newState;
      if (this.onsignalingstatechange !== null) {
        this.onsignalingstatechange();
      }
    };

    // Update the ICE connection state.
    window.RTCPeerConnection.prototype._updateIceConnectionState =
        function(newState) {
      var self = this;
      if (this.iceConnectionState !== newState) {
        var agreement = self.tracks.every(function(track) {
          return track.iceTransport.state === newState;
        });
        if (agreement) {
          self.iceConnectionState = newState;
          if (this.oniceconnectionstatechange !== null) {
            this.oniceconnectionstatechange();
          }
        }
      }
    };

    window.RTCPeerConnection.prototype.createOffer = function() {
      var self = this;
      var offerOptions;
      if (arguments.length === 1 && typeof arguments[0] !== 'function') {
        offerOptions = arguments[0];
      } else if (arguments.length === 3) {
        offerOptions = arguments[2];
      }

      var mlines = [];
      var numAudioTracks = 0;
      var numVideoTracks = 0;
      // Default to sendrecv.
      if (this.localStreams.length) {
        numAudioTracks = this.localStreams[0].getAudioTracks().length;
        numVideoTracks = this.localStreams[0].getAudioTracks().length;
      }
      // Determine number of audio and video tracks we need to send/recv.
      if (offerOptions) {
        // Deal with Chrome legacy constraints...
        if (offerOptions.mandatory) {
          if (offerOptions.mandatory.OfferToReceiveAudio) {
            numAudioTracks = 1;
          } else if (offerOptions.mandatory.OfferToReceiveAudio === false) {
            numAudioTracks = 0;
          }
          if (offerOptions.mandatory.OfferToReceiveVideo) {
            numVideoTracks = 1;
          } else if (offerOptions.mandatory.OfferToReceiveVideo === false) {
            numVideoTracks = 0;
          }
        } else {
          if (offerOptions.offerToReceiveAudio !== undefined) {
            numAudioTracks = offerOptions.offerToReceiveAudio;
          }
          if (offerOptions.offerToReceiveVideo !== undefined) {
            numVideoTracks = offerOptions.offerToReceiveVideo;
          }
        }
      }
      if (this.localStreams.length) {
        // Push local streams.
        this.localStreams[0].getTracks().forEach(function(track) {
          mlines.push({
            kind: track.kind,
            track: track,
            wantReceive: track.kind === 'audio' ?
                numAudioTracks > 0 : numVideoTracks > 0
          });
          if (track.kind === 'audio') {
            numAudioTracks--;
          } else if (track.kind === 'video') {
            numVideoTracks--;
          }
        });
      }
      // Create M-lines for recvonly streams.
      while (numAudioTracks > 0 || numVideoTracks > 0) {
        if (numAudioTracks > 0) {
          mlines.push({
            kind: 'audio',
            wantReceive: true
          });
          numAudioTracks--;
        }
        if (numVideoTracks > 0) {
          mlines.push({
            kind: 'video',
            wantReceive: true
          });
          numVideoTracks--;
        }
      }

      var sdp = 'v=0\r\n' +
          'o=thisisadapterortc 8169639915646943137 2 IN IP4 127.0.0.1\r\n' +
          's=-\r\n' +
          't=0 0\r\n';
      var tracks = [];
      mlines.forEach(function(mline, sdpMLineIndex) {
        // For each track, create an ice gatherer, ice transport, dtls transport,
        // potentially rtpsender and rtpreceiver.
        var track = mline.track;
        var kind = mline.kind;
        var mid = Math.random().toString(36).substr(2, 10);

        var transports = self._createIceAndDtlsTransports(mid, sdpMLineIndex);

        var localCapabilities = RTCRtpSender.getCapabilities(kind);
        var rtpSender;
        // generate an ssrc now, to be used later in rtpSender.send
        var sendSSRC = (2 * sdpMLineIndex + 1) * 1001; //Math.floor(Math.random()*4294967295);
        var recvSSRC; // don't know yet
        if (track) {
          rtpSender = new RTCRtpSender(track, transports.dtlsTransport);
        }

        var rtpReceiver;
        if (mline.wantReceive) {
          rtpReceiver = new RTCRtpReceiver(transports.dtlsTransport, kind);
        }

        tracks[sdpMLineIndex] = {
          iceGatherer: transports.iceGatherer,
          iceTransport: transports.iceTransport,
          dtlsTransport: transports.dtlsTransport,
          localCapabilities: localCapabilities,
          remoteCapabilities: null,
          rtpSender: rtpSender,
          rtpReceiver: rtpReceiver,
          kind: kind,
          mid: mid,
          sendSSRC: sendSSRC,
          recvSSRC: recvSSRC,
          remoteCandidates: []
        };

        // Map things to SDP.
        // Build the mline.
        sdp += 'm=' + kind + ' 9 UDP/TLS/RTP/SAVPF ';
        sdp += localCapabilities.codecs.map(function(codec) {
          return codec.preferredPayloadType;
        }).join(' ') + '\r\n';

        sdp += 'c=IN IP4 0.0.0.0\r\n';
        sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';

        // Map ICE parameters (ufrag, pwd) to SDP.
        sdp += self._iceParametersToSDP(
            transports.iceGatherer.getLocalParameters());

        // Map DTLS parameters to SDP.
        sdp += self._dtlsParametersToSDP(
            transports.dtlsTransport.getLocalParameters(), 'actpass');

        sdp += 'a=mid:' + mid + '\r\n';

        if (rtpSender && rtpReceiver) {
          sdp += 'a=sendrecv\r\n';
        } else if (rtpSender) {
          sdp += 'a=sendonly\r\n';
        } else if (rtpReceiver) {
          sdp += 'a=recvonly\r\n';
        } else {
          sdp += 'a=inactive\r\n';
        }
        sdp += 'a=rtcp-mux\r\n';

        // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
        sdp += self._capabilitiesToSDP(localCapabilities);

        if (track) {
          sdp += 'a=msid:' + self.localStreams[0].id + ' ' + track.id + '\r\n';
          sdp += 'a=ssrc:' + sendSSRC + ' ' + 'msid:' +
              self.localStreams[0].id + ' ' + track.id + '\r\n';
        }
        sdp += 'a=ssrc:' + sendSSRC + ' cname:' + self._cname + '\r\n';
      });

      var desc = new RTCSessionDescription({
        type: 'offer',
        sdp: sdp,
        ortc: tracks
      });
      if (arguments.length && typeof arguments[0] === 'function') {
        window.setTimeout(arguments[0], 0, desc);
      }
      return new Promise(function(resolve) {
        resolve(desc);
      });
    };

    window.RTCPeerConnection.prototype.createAnswer = function() {
      var self = this;
      var answerOptions;
      if (arguments.length === 1 && typeof arguments[0] !== 'function') {
        answerOptions = arguments[0];
      } else if (arguments.length === 3) {
        answerOptions = arguments[2];
      }

      var sdp = 'v=0\r\n' +
          'o=thisisadapterortc 8169639915646943137 2 IN IP4 127.0.0.1\r\n' +
          's=-\r\n' +
          't=0 0\r\n';
      this.tracks.forEach(function(track/*, sdpMLineIndex*/) {
        var iceGatherer = track.iceGatherer;
        //var iceTransport = track.iceTransport;
        var dtlsTransport = track.dtlsTransport;
        var localCapabilities = track.localCapabilities;
        var remoteCapabilities = track.remoteCapabilities;
        var rtpSender = track.rtpSender;
        var rtpReceiver = track.rtpReceiver;
        var kind = track.kind;
        var sendSSRC = track.sendSSRC;
        //var recvSSRC = track.recvSSRC;

        // Calculate intersection of capabilities.
        var commonCapabilities = self._getCommonCapabilities(localCapabilities,
            remoteCapabilities);

        // Map things to SDP.
        // Build the mline.
        sdp += 'm=' + kind + ' 9 UDP/TLS/RTP/SAVPF ';
        sdp += commonCapabilities.codecs.map(function(codec) {
          return codec.payloadType;
        }).join(' ') + '\r\n';

        sdp += 'c=IN IP4 0.0.0.0\r\n';
        sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';

        // Map ICE parameters (ufrag, pwd) to SDP.
        sdp += self._iceParametersToSDP(iceGatherer.getLocalParameters());

        // Map DTLS parameters to SDP.
        sdp += self._dtlsParametersToSDP(dtlsTransport.getLocalParameters(),
            'active');

        sdp += 'a=mid:' + track.mid + '\r\n';

        if (rtpSender && rtpReceiver) {
          sdp += 'a=sendrecv\r\n';
        } else if (rtpReceiver) {
          sdp += 'a=sendonly\r\n';
        } else if (rtpSender) {
          sdp += 'a=recvonly\r\n';
        } else {
          sdp += 'a=inactive\r\n';
        }
        sdp += 'a=rtcp-mux\r\n';

        // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
        sdp += self._capabilitiesToSDP(commonCapabilities);

        if (rtpSender) {
          // add a=ssrc lines from RTPSender
          sdp += 'a=msid:' + self.localStreams[0].id + ' ' +
              rtpSender.track.id + '\r\n';
          sdp += 'a=ssrc:' + sendSSRC + ' ' + 'msid:' +
              self.localStreams[0].id + ' ' + rtpSender.track.id + '\r\n';
        }
        sdp += 'a=ssrc:' + sendSSRC + ' cname:' + self._cname + '\r\n';
      });

      var desc = new RTCSessionDescription({
        type: 'answer',
        sdp: sdp
        // ortc: tracks -- state is created in SRD already
      });
      if (arguments.length && typeof arguments[0] === 'function') {
        window.setTimeout(arguments[0], 0, desc);
      }
      return new Promise(function(resolve) {
        resolve(desc);
      });
    };

    window.RTCPeerConnection.prototype.addIceCandidate = function(candidate) {
      var track = this.tracks[candidate.sdpMLineIndex];
      // console.log("addIceCandidate:", candidate);
      if (track) {
        // console.log("track:", track);
        var cand = Object.keys(candidate.candidate).length > 0 ?
            this._toCandidateJSON(candidate.candidate) : {};
        // dirty hack to make simplewebrtc work.
        // FIXME: need another dirty hack to avoid adding candidates after this
        if (cand.type === 'endOfCandidates') {
          cand = {};
        }
        // dirty hack to make chrome work.
        if (cand.protocol === 'tcp' && cand.port === 0) {
          cand = {};
          window.setTimeout(function() {
            track.iceTransport.addRemoteCandidate(cand);
          }, 5000);
          return;
        }
        track.iceTransport.addRemoteCandidate(cand);
      }
      if (arguments.length > 1 && typeof arguments[1] === 'function') {
        window.setTimeout(arguments[1], 0);
      }
      return new Promise(function(resolve) {
        resolve();
      });
    };

    /*
    window.RTCPeerConnection.prototype.getStats = function(callback, errback) {
    };
    */
  }
} else {
  // console.log('Browser does not appear to be WebRTC-capable');
}

// Returns the result of getUserMedia as a Promise.
function requestUserMedia(constraints) {
  return new Promise(function(resolve, reject) {
    var onSuccess = function(stream) {
      resolve(stream);
    };
    var onError = function(error) {
      reject(error);
    };

    try {
      getUserMedia(constraints, onSuccess, onError);
    } catch (e) {
      reject(e);
    }
  });
}

window.RTCPeerConnection = RTCPeerConnection;
window.getUserMedia = getUserMedia;
window.attachMediaStream = attachMediaStream;
window.reattachMediaStream = reattachMediaStream;
window.webrtcDetectedBrowser = webrtcDetectedBrowser;
window.webrtcDetectedVersion = webrtcDetectedVersion;

/*
	The MIT License (MIT)

	Copyright (c) 2016 Meetecho

	Permission is hereby granted, free of charge, to any person obtaining
	a copy of this software and associated documentation files (the "Software"),
	to deal in the Software without restriction, including without limitation
	the rights to use, copy, modify, merge, publish, distribute, sublicense,
	and/or sell copies of the Software, and to permit persons to whom the
	Software is furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included
	in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
	THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
	OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
	ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
	OTHER DEALINGS IN THE SOFTWARE.
 */

// List of sessions
Janus.sessions = {};

// Screensharing Chrome Extension ID
Janus.extensionId = "hapfgfdkleiggjjpfpenajgdnfckjpaj";
Janus.isExtensionEnabled = function() {
	if(window.navigator.userAgent.match('Chrome')) {
		var chromever = parseInt(window.navigator.userAgent.match(/Chrome\/(.*) /)[1], 10);
		var maxver = 33;
		if(window.navigator.userAgent.match('Linux'))
			maxver = 35;	// "known" crash in chrome 34 and 35 on linux
		if(chromever >= 26 && chromever <= maxver) {
			// Older versions of Chrome don't support this extension-based approach, so lie
			return true;
		}
		return ($('#janus-extension-installed').length > 0);
	} else {
		// Firefox of others, no need for the extension (but this doesn't mean it will work)
		return true;
	}
};

Janus.noop = function() {};

// Initialization
Janus.init = function(options) {
	options = options || {};
	options.callback = (typeof options.callback == "function") ? options.callback : Janus.noop;
	if(Janus.initDone === true) {
		// Already initialized
		options.callback();
	} else {
		if(typeof console == "undefined" || typeof console.log == "undefined")
			console = { log: function() {} };
		// Console logging (all debugging disabled by default)
		Janus.trace = Janus.noop;
		Janus.debug = Janus.noop;
		Janus.log = Janus.noop;
		Janus.warn = Janus.noop;
		Janus.error = Janus.noop;
		if(options.debug === true || options.debug === "all") {
			// Enable all debugging levels
			Janus.trace = console.trace.bind(console);
			Janus.debug = console.debug.bind(console);
			Janus.log = console.log.bind(console);
			Janus.warn = console.warn.bind(console);
			Janus.error = console.error.bind(console);
		} else if(Array.isArray(options.debug)) {
			for(var i in options.debug) {
				var d = options.debug[i];
				switch(d) {
					case "trace":
						Janus.trace = console.trace.bind(console);
						break;
					case "debug":
						Janus.debug = console.debug.bind(console);
						break;
					case "log":
						Janus.log = console.log.bind(console);
						break;
					case "warn":
						Janus.warn = console.warn.bind(console);
						break;
					case "error":
						Janus.error = console.error.bind(console);
						break;
					default:
						console.error("Unknown debugging option '" + d + "' (supported: 'trace', 'debug', 'log', warn', 'error')");
						break;
				}
			}
		}
		Janus.log("Initializing library");
		Janus.initDone = true;
		// Detect tab close
		window.onbeforeunload = function() {
			Janus.log("Closing window");
			for(var s in Janus.sessions) {
				if(Janus.sessions[s] !== null && Janus.sessions[s] !== undefined &&
						Janus.sessions[s].destroyOnUnload) {
					Janus.log("Destroying session " + s);
					Janus.sessions[s].destroy();
				}
			}
		}
		function addJsList(srcArray) {
			if (!srcArray || !Array.isArray(srcArray) || srcArray.length == 0) {
				options.callback();
			}
			var count = 0;
			addJs(srcArray[count],next);

			function next() {
				count++;
				if (count<srcArray.length) {
					addJs(srcArray[count],next);
				}
				else {
					options.callback();
				}
			}
		}
		function addJs(src,done) {
			if(src === 'jquery.min.js') {
				if(window.jQuery) {
					// Already loaded
					done();
					return;
				}
			}
			if(src === 'adapter.js') {
				if(window.getUserMedia && window.RTCPeerConnection) {
					// Already loaded
					done();
					return;
				}
			}
			var oHead = document.getElementsByTagName('head').item(0);
			var oScript = document.createElement("script");
			oScript.type = "text/javascript";
			oScript.src = src;
			oScript.onload = function() {
				Janus.log("Library " + src + " loaded");
				done();
			}
			oHead.appendChild(oScript);
		}
                // CUSTOM MOD
		// addJsList(["adapter.js","jquery.min.js"]);
	        options.callback();
	}
};

// Helper method to check whether WebRTC is supported by this browser
Janus.isWebrtcSupported = function() {
	if(RTCPeerConnection === null || getUserMedia === null) {
		return false;
	}
	return true;
};

function Janus(gatewayCallbacks) {
	if(Janus.initDone === undefined) {
		gatewayCallbacks.error("Library not initialized");
		return {};
	}
	if(!Janus.isWebrtcSupported()) {
		gatewayCallbacks.error("WebRTC not supported by this browser");
		return {};
	}
	Janus.log("Library initialized: " + Janus.initDone);
	gatewayCallbacks = gatewayCallbacks || {};
	gatewayCallbacks.success = (typeof gatewayCallbacks.success == "function") ? gatewayCallbacks.success : jQuery.noop;
	gatewayCallbacks.error = (typeof gatewayCallbacks.error == "function") ? gatewayCallbacks.error : jQuery.noop;
	gatewayCallbacks.destroyed = (typeof gatewayCallbacks.destroyed == "function") ? gatewayCallbacks.destroyed : jQuery.noop;
	if(gatewayCallbacks.server === null || gatewayCallbacks.server === undefined) {
		gatewayCallbacks.error("Invalid gateway url");
		return {};
	}
	var websockets = false;
	var ws = null;
	var wsHandlers = {};
	var wsKeepaliveTimeoutId = null;

	var servers = null, serversIndex = 0;
	var server = gatewayCallbacks.server;
	if($.isArray(server)) {
		Janus.log("Multiple servers provided (" + server.length + "), will use the first that works");
		server = null;
		servers = gatewayCallbacks.server;
		Janus.debug(servers);
	} else {
		if(server.indexOf("ws") === 0) {
			websockets = true;
			Janus.log("Using WebSockets to contact Janus: " + server);
		} else {
			websockets = false;
			Janus.log("Using REST API to contact Janus: " + server);
		}
	}
	var iceServers = gatewayCallbacks.iceServers;
	if(iceServers === undefined || iceServers === null)
		iceServers = [{"url": "stun:stun.l.google.com:19302"}];
	// Whether IPv6 candidates should be gathered
	var ipv6Support = gatewayCallbacks.ipv6;
	if(ipv6Support === undefined || ipv6Support === null)
		ipv6Support = false;
	// Optional max events
	var maxev = null;
	if(gatewayCallbacks.max_poll_events !== undefined && gatewayCallbacks.max_poll_events !== null)
		maxev = gatewayCallbacks.max_poll_events;
	if(maxev < 1)
		maxev = 1;
	// Token to use (only if the token based authentication mechanism is enabled)
	var token = null;
	if(gatewayCallbacks.token !== undefined && gatewayCallbacks.token !== null)
		token = gatewayCallbacks.token;
	// API secret to use (only if the shared API secret is enabled)
	var apisecret = null;
	if(gatewayCallbacks.apisecret !== undefined && gatewayCallbacks.apisecret !== null)
		apisecret = gatewayCallbacks.apisecret;
	// Whether we should destroy this session when onbeforeunload is called
	this.destroyOnUnload = true;
	if(gatewayCallbacks.destroyOnUnload !== undefined && gatewayCallbacks.destroyOnUnload !== null)
		this.destroyOnUnload = (gatewayCallbacks.destroyOnUnload === true);

	var connected = false;
	var sessionId = null;
	var pluginHandles = {};
	var that = this;
	var retries = 0;
	var transactions = {};
	createSession(gatewayCallbacks);

	// Public methods
	this.getServer = function() { return server; };
	this.isConnected = function() { return connected; };
	this.getSessionId = function() { return sessionId; };
	this.destroy = function(callbacks) { destroySession(callbacks); };
	this.attach = function(callbacks) { createHandle(callbacks); };

	// Private method to create random identifiers (e.g., transaction)
	function randomString(len) {
		charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		var randomString = '';
		for (var i = 0; i < len; i++) {
			var randomPoz = Math.floor(Math.random() * charSet.length);
			randomString += charSet.substring(randomPoz,randomPoz+1);
		}
		return randomString;
	}

	function eventHandler() {
		if(sessionId == null)
			return;
		Janus.debug('Long poll...');
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			return;
		}
		var longpoll = server + "/" + sessionId + "?rid=" + new Date().getTime();
		if(maxev !== undefined && maxev !== null)
			longpoll = longpoll + "&maxev=" + maxev;
		if(token !== null && token !== undefined)
			longpoll = longpoll + "&token=" + token;
		if(apisecret !== null && apisecret !== undefined)
			longpoll = longpoll + "&apisecret=" + apisecret;
		$.ajax({
			type: 'GET',
			url: longpoll,
			cache: false,
			timeout: 60000,	// FIXME
			success: handleEvent,
			error: function(XMLHttpRequest, textStatus, errorThrown) {
				Janus.error(textStatus + ": " + errorThrown);
				//~ clearTimeout(timeoutTimer);
				retries++;
				if(retries > 3) {
					// Did we just lose the gateway? :-(
					connected = false;
					gatewayCallbacks.error("Lost connection to the gateway (is it down?)");
					return;
				}
				eventHandler();
			},
			dataType: "json"
		});
	}

	// Private event handler: this will trigger plugin callbacks, if set
	function handleEvent(json) {
		retries = 0;
		if(!websockets && sessionId !== undefined && sessionId !== null)
			setTimeout(eventHandler, 200);
		Janus.debug("Got event on session " + sessionId);
		Janus.debug(json);
		if(!websockets && $.isArray(json)) {
			// We got an array: it means we passed a maxev > 1, iterate on all objects
			for(var i=0; i<json.length; i++) {
				handleEvent(json[i]);
			}
			return;
		}
		if(json["janus"] === "keepalive") {
			// Nothing happened
			return;
		} else if(json["janus"] === "ack") {
			// Just an ack, we can probably ignore
			var transaction = json["transaction"];
			if(transaction !== null && transaction !== undefined) {
				var reportSuccess = transactions[transaction];
				if(reportSuccess !== null && reportSuccess !== undefined) {
					reportSuccess(json);
				}
				delete transactions[transaction];
			}
			return;
		} else if(json["janus"] === "success") {
			// Success!
			var transaction = json["transaction"];
			if(transaction !== null && transaction !== undefined) {
				var reportSuccess = transactions[transaction];
				if(reportSuccess !== null && reportSuccess !== undefined) {
					reportSuccess(json);
				}
				delete transactions[transaction];
			}
			return;
		} else if(json["janus"] === "webrtcup") {
			// The PeerConnection with the gateway is up! FIXME Should we notify this?
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.warn("This handle is not attached to this session");
				return;
			}
			pluginHandle.webrtcState(true);
			return;
		} else if(json["janus"] === "hangup") {
			// A plugin asked the core to hangup a PeerConnection on one of our handles
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.warn("This handle is not attached to this session");
				return;
			}
			pluginHandle.webrtcState(false);
			pluginHandle.hangup();
		} else if(json["janus"] === "detached") {
			// A plugin asked the core to detach one of our handles
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.warn("This handle is not attached to this session");
				return;
			}
			pluginHandle.ondetached();
			pluginHandle.detach();
		} else if(json["janus"] === "media") {
			// Media started/stopped flowing
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.warn("This handle is not attached to this session");
				return;
			}
			pluginHandle.mediaState(json["type"], json["receiving"]);
		} else if(json["janus"] === "error") {
			// Oops, something wrong happened
			// Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
			var transaction = json["transaction"];
			if(transaction !== null && transaction !== undefined) {
				var reportSuccess = transactions[transaction];
				if(reportSuccess !== null && reportSuccess !== undefined) {
					reportSuccess(json);
				}
				delete transactions[transaction];
			}
			return;
		} else if(json["janus"] === "event") {
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var plugindata = json["plugindata"];
			if(plugindata === undefined || plugindata === null) {
				Janus.warn("Missing plugindata...");
				return;
			}
			Janus.debug("  -- Event is coming from " + sender + " (" + plugindata["plugin"] + ")");
			var data = plugindata["data"];
			Janus.debug(data);
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.warn("This handle is not attached to this session");
				return;
			}
			var jsep = json["jsep"];
			if(jsep !== undefined && jsep !== null) {
				Janus.debug("Handling SDP as well...");
				Janus.debug(jsep);
			}
			var callback = pluginHandle.onmessage;
			if(callback !== null && callback !== undefined) {
				Janus.debug("Notifying application...");
				// Send to callback specified when attaching plugin handle
				callback(data, jsep);
			} else {
				// Send to generic callback (?)
				Janus.debug("No provided notification callback");
			}
		} else {
			Janus.warn("Unknown message '" + json["janus"] + "'");
		}
	}

	// Private helper to send keep-alive messages on WebSockets
	function keepAlive() {
		if(server === null || !websockets || !connected)
			return;
		wsKeepaliveTimeoutId = setTimeout(keepAlive, 30000);
		var request = { "janus": "keepalive", "session_id": sessionId, "transaction": randomString(12) };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		ws.send(JSON.stringify(request));
	}

	// Private method to create a session
	function createSession(callbacks) {
		var transaction = randomString(12);
		var request = { "janus": "create", "transaction": transaction };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		if(server === null && $.isArray(servers)) {
			// We still need to find a working server from the list we were given
			server = servers[serversIndex];
			if(server.indexOf("ws") === 0) {
				websockets = true;
				Janus.log("Server #" + (serversIndex+1) + ": trying WebSockets to contact Janus (" + server + ")");
			} else {
				websockets = false;
				Janus.log("Server #" + (serversIndex+1) + ": trying REST API to contact Janus (" + server + ")");
			}
		}
		if(websockets) {
			ws = new WebSocket(server, 'janus-protocol');
			wsHandlers = {
				'error': function() {
					Janus.error("Error connecting to the Janus WebSockets server... " + server);
					if ($.isArray(servers)) {
						serversIndex++;
						if (serversIndex == servers.length) {
							// We tried all the servers the user gave us and they all failed
							callbacks.error("Error connecting to any of the provided Janus servers: Is the gateway down?");
							return;
						}
						// Let's try the next server
						server = null;
						setTimeout(function() {
							createSession(callbacks);
						}, 200);
						return;
					}
					callbacks.error("Error connecting to the Janus WebSockets server: Is the gateway down?");
				},

				'open': function() {
					// We need to be notified about the success
					transactions[transaction] = function(json) {
						Janus.debug(json);
						if (json["janus"] !== "success") {
							Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
							callbacks.error(json["error"].reason);
							return;
						}
						wsKeepaliveTimeoutId = setTimeout(keepAlive, 30000);
						connected = true;
						sessionId = json.data["id"];
						Janus.log("Created session: " + sessionId);
						Janus.sessions[sessionId] = that;
						callbacks.success();
					};
					ws.send(JSON.stringify(request));
				},

				'message': function(event) {
					handleEvent(JSON.parse(event.data));
				},

				'close': function() {
					if (server === null || !connected) {
						return;
					}
					connected = false;
					// FIXME What if this is called when the page is closed?
					gatewayCallbacks.error("Lost connection to the gateway (is it down?)");
				}
			};

			for(var eventName in wsHandlers) {
				ws.addEventListener(eventName, wsHandlers[eventName]);
			}

			return;
		}
		$.ajax({
			type: 'POST',
			url: server,
			cache: false,
			contentType: "application/json",
			data: JSON.stringify(request),
			success: function(json) {
				Janus.debug(json);
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
					callbacks.error(json["error"].reason);
					return;
				}
				connected = true;
				sessionId = json.data["id"];
				Janus.log("Created session: " + sessionId);
				Janus.sessions[sessionId] = that;
				eventHandler();
				callbacks.success();
			},
			error: function(XMLHttpRequest, textStatus, errorThrown) {
				Janus.error(textStatus + ": " + errorThrown);	// FIXME
				if($.isArray(servers)) {
					serversIndex++;
					if(serversIndex == servers.length) {
						// We tried all the servers the user gave us and they all failed
						callbacks.error("Error connecting to any of the provided Janus servers: Is the gateway down?");
						return;
					}
					// Let's try the next server
					server = null;
					setTimeout(function() { createSession(callbacks); }, 200);
					return;
				}
				if(errorThrown === "")
					callbacks.error(textStatus + ": Is the gateway down?");
				else
					callbacks.error(textStatus + ": " + errorThrown);
			},
			dataType: "json"
		});
	}

	// Private method to destroy a session
	function destroySession(callbacks, syncRequest) {
                var cleanupWs = function() {
                  if (ws)
                  {
                    ws.close();
                    connected = false;
                    sessionId = null;
                    delete(Janus.initDone);

                  }
                }
		syncRequest = (syncRequest === true);
		Janus.log("Destroying session " + sessionId + " (sync=" + syncRequest + ")");
		callbacks = callbacks || {};
		// FIXME This method triggers a success even when we fail
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		if(!connected) {
                        cleanupWs();
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.success();
			return;
		}
		if(sessionId === undefined || sessionId === null) {
                        cleanupWs();
			Janus.warn("No session to destroy");
			callbacks.success();
			gatewayCallbacks.destroyed();
			return;
		}
		delete Janus.sessions[sessionId];
		// Destroy all handles first
		for(var ph in pluginHandles) {
			var phv = pluginHandles[ph];
			Janus.log("Destroying handle " + phv.id + " (" + phv.plugin + ")");
			destroyHandle(phv.id, null, syncRequest);
		}
		// Ok, go on
		var request = { "janus": "destroy", "transaction": randomString(12) };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		if(websockets) {
			request["session_id"] = sessionId;

			var unbindWebSocket = function() {
				for(var eventName in wsHandlers) {
					ws.removeEventListener(eventName, wsHandlers[eventName]);
				}
				ws.removeEventListener('message', onUnbindMessage);
				ws.removeEventListener('error', onUnbindError);
				if(wsKeepaliveTimeoutId) {
					clearTimeout(wsKeepaliveTimeoutId);
				}
			};

			var onUnbindMessage = function(event){
				var data = JSON.parse(event.data);
				if(data.session_id == request.session_id && data.transaction == request.transaction) {
					unbindWebSocket();
					callbacks.success();
					gatewayCallbacks.destroyed();
				}
			};
			var onUnbindError = function(event) {
				unbindWebSocket();
				// callbacks.error("Failed to destroy the gateway: Is the gateway down?");
				gatewayCallbacks.destroyed();
			};

			ws.addEventListener('message', onUnbindMessage);
			ws.addEventListener('error', onUnbindError);

			ws.send(JSON.stringify(request));
                        cleanupWs();
			return;
		}
		$.ajax({
			type: 'POST',
			url: server + "/" + sessionId,
			async: syncRequest,	// Sometimes we need false here, or destroying in onbeforeunload won't work
			cache: false,
			contentType: "application/json",
			data: JSON.stringify(request),
			success: function(json) {
				Janus.log("Destroyed session:");
				Janus.debug(json);
				sessionId = null;
				connected = false;
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
				}
				callbacks.success();
				gatewayCallbacks.destroyed();
			},
			error: function(XMLHttpRequest, textStatus, errorThrown) {
				Janus.error(textStatus + ": " + errorThrown);	// FIXME
				// Reset everything anyway
				sessionId = null;
				connected = false;
				callbacks.success();
				gatewayCallbacks.destroyed();
			},
			dataType: "json"
		});
	}

	// Private method to create a plugin handle
	function createHandle(callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		callbacks.consentDialog = (typeof callbacks.consentDialog == "function") ? callbacks.consentDialog : jQuery.noop;
		callbacks.mediaState = (typeof callbacks.mediaState == "function") ? callbacks.mediaState : jQuery.noop;
		callbacks.webrtcState = (typeof callbacks.webrtcState == "function") ? callbacks.webrtcState : jQuery.noop;
		callbacks.onmessage = (typeof callbacks.onmessage == "function") ? callbacks.onmessage : jQuery.noop;
		callbacks.onlocalstream = (typeof callbacks.onlocalstream == "function") ? callbacks.onlocalstream : jQuery.noop;
		callbacks.onremotestream = (typeof callbacks.onremotestream == "function") ? callbacks.onremotestream : jQuery.noop;
		callbacks.ondata = (typeof callbacks.ondata == "function") ? callbacks.ondata : jQuery.noop;
		callbacks.ondataopen = (typeof callbacks.ondataopen == "function") ? callbacks.ondataopen : jQuery.noop;
		callbacks.oncleanup = (typeof callbacks.oncleanup == "function") ? callbacks.oncleanup : jQuery.noop;
		callbacks.ondetached = (typeof callbacks.ondetached == "function") ? callbacks.ondetached : jQuery.noop;
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.error("Is the gateway down? (connected=false)");
			return;
		}
		var plugin = callbacks.plugin;
		if(plugin === undefined || plugin === null) {
			Janus.error("Invalid plugin");
			callbacks.error("Invalid plugin");
			return;
		}
		var transaction = randomString(12);
		var request = { "janus": "attach", "plugin": plugin, "transaction": transaction };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		if(websockets) {
			transactions[transaction] = function(json) {
				Janus.debug(json);
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
					callbacks.error("Ooops: " + json["error"].code + " " + json["error"].reason);
					return;
				}
				var handleId = json.data["id"];
				Janus.log("Created handle: " + handleId);
				var pluginHandle =
					{
						session : that,
						plugin : plugin,
						id : handleId,
						webrtcStuff : {
							started : false,
							myStream : null,
							streamExternal : false,
							remoteStream : null,
							mySdp : null,
							pc : null,
							dataChannel : null,
							dtmfSender : null,
							trickle : true,
							iceDone : false,
							sdpSent : false,
							volume : {
								value : null,
								timer : null
							},
							bitrate : {
								value : null,
								bsnow : null,
								bsbefore : null,
								tsnow : null,
								tsbefore : null,
								timer : null
							}
						},
						getId : function() { return handleId; },
						getPlugin : function() { return plugin; },
						getVolume : function() { return getVolume(handleId); },
						isAudioMuted : function() { return isMuted(handleId, false); },
						muteAudio : function() { return mute(handleId, false, true); },
						unmuteAudio : function() { return mute(handleId, false, false); },
						isVideoMuted : function() { return isMuted(handleId, true); },
						muteVideo : function() { return mute(handleId, true, true); },
						unmuteVideo : function() { return mute(handleId, true, false); },
						getBitrate : function() { return getBitrate(handleId); },
						send : function(callbacks) { sendMessage(handleId, callbacks); },
						data : function(callbacks) { sendData(handleId, callbacks); },
						dtmf : function(callbacks) { sendDtmf(handleId, callbacks); },
						consentDialog : callbacks.consentDialog,
						mediaState : callbacks.mediaState,
						webrtcState : callbacks.webrtcState,
						onmessage : callbacks.onmessage,
						createOffer : function(callbacks) { prepareWebrtc(handleId, callbacks); },
						createAnswer : function(callbacks) { prepareWebrtc(handleId, callbacks); },
						handleRemoteJsep : function(callbacks) { prepareWebrtcPeer(handleId, callbacks); },
						onlocalstream : callbacks.onlocalstream,
						onremotestream : callbacks.onremotestream,
						ondata : callbacks.ondata,
						ondataopen : callbacks.ondataopen,
						oncleanup : callbacks.oncleanup,
						ondetached : callbacks.ondetached,
						hangup : function(sendRequest) { cleanupWebrtc(handleId, sendRequest === true); },
						detach : function(callbacks) { destroyHandle(handleId, callbacks); }
					}
				pluginHandles[handleId] = pluginHandle;
				callbacks.success(pluginHandle);
			};
			request["session_id"] = sessionId;
			ws.send(JSON.stringify(request));
			return;
		}
		$.ajax({
			type: 'POST',
			url: server + "/" + sessionId,
			cache: false,
			contentType: "application/json",
			data: JSON.stringify(request),
			success: function(json) {
				Janus.debug(json);
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
					callbacks.error("Ooops: " + json["error"].code + " " + json["error"].reason);
					return;
				}
				var handleId = json.data["id"];
				Janus.log("Created handle: " + handleId);
				var pluginHandle =
					{
						session : that,
						plugin : plugin,
						id : handleId,
						webrtcStuff : {
							started : false,
							myStream : null,
							streamExternal : false,
							remoteStream : null,
							mySdp : null,
							pc : null,
							dataChannel : null,
							dtmfSender : null,
							trickle : true,
							iceDone : false,
							sdpSent : false,
							volume : {
								value : null,
								timer : null
							},
							bitrate : {
								value : null,
								bsnow : null,
								bsbefore : null,
								tsnow : null,
								tsbefore : null,
								timer : null
							}
						},
						getId : function() { return handleId; },
						getPlugin : function() { return plugin; },
						getVolume : function() { return getVolume(handleId); },
						isAudioMuted : function() { return isMuted(handleId, false); },
						muteAudio : function() { return mute(handleId, false, true); },
						unmuteAudio : function() { return mute(handleId, false, false); },
						isVideoMuted : function() { return isMuted(handleId, true); },
						muteVideo : function() { return mute(handleId, true, true); },
						unmuteVideo : function() { return mute(handleId, true, false); },
						getBitrate : function() { return getBitrate(handleId); },
						send : function(callbacks) { sendMessage(handleId, callbacks); },
						data : function(callbacks) { sendData(handleId, callbacks); },
						dtmf : function(callbacks) { sendDtmf(handleId, callbacks); },
						consentDialog : callbacks.consentDialog,
						mediaState : callbacks.mediaState,
						webrtcState : callbacks.webrtcState,
						onmessage : callbacks.onmessage,
						createOffer : function(callbacks) { prepareWebrtc(handleId, callbacks); },
						createAnswer : function(callbacks) { prepareWebrtc(handleId, callbacks); },
						handleRemoteJsep : function(callbacks) { prepareWebrtcPeer(handleId, callbacks); },
						onlocalstream : callbacks.onlocalstream,
						onremotestream : callbacks.onremotestream,
						ondata : callbacks.ondata,
						ondataopen : callbacks.ondataopen,
						oncleanup : callbacks.oncleanup,
						ondetached : callbacks.ondetached,
						hangup : function(sendRequest) { cleanupWebrtc(handleId, sendRequest === true); },
						detach : function(callbacks) { destroyHandle(handleId, callbacks); }
					}
				pluginHandles[handleId] = pluginHandle;
				callbacks.success(pluginHandle);
			},
			error: function(XMLHttpRequest, textStatus, errorThrown) {
				Janus.error(textStatus + ": " + errorThrown);	// FIXME
			},
			dataType: "json"
		});
	}

	// Private method to send a message
	function sendMessage(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.error("Is the gateway down? (connected=false)");
			return;
		}
		var message = callbacks.message;
		var jsep = callbacks.jsep;
		var transaction = randomString(12);
		var request = { "janus": "message", "body": message, "transaction": transaction };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		if(jsep !== null && jsep !== undefined)
			request.jsep = jsep;
		Janus.debug("Sending message to plugin (handle=" + handleId + "):");
		Janus.debug(request);
		if(websockets) {
			request["session_id"] = sessionId;
			request["handle_id"] = handleId;
			transactions[transaction] = function(json) {
				Janus.debug("Message sent!");
				Janus.debug(json);
				if(json["janus"] === "success") {
					// We got a success, must have been a synchronous transaction
					var plugindata = json["plugindata"];
					if(plugindata === undefined || plugindata === null) {
						Janus.warn("Request succeeded, but missing plugindata...");
						callbacks.success();
						return;
					}
					Janus.log("Synchronous transaction successful (" + plugindata["plugin"] + ")");
					var data = plugindata["data"];
					Janus.debug(data);
					callbacks.success(data);
					return;
				} else if(json["janus"] !== "ack") {
					// Not a success and not an ack, must be an error
					if(json["error"] !== undefined && json["error"] !== null) {
						Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
						callbacks.error(json["error"].code + " " + json["error"].reason);
					} else {
						Janus.error("Unknown error");	// FIXME
						callbacks.error("Unknown error");
					}
					return;
				}
				// If we got here, the plugin decided to handle the request asynchronously
				callbacks.success();
			};
			ws.send(JSON.stringify(request));
			return;
		}
		$.ajax({
			type: 'POST',
			url: server + "/" + sessionId + "/" + handleId,
			cache: false,
			contentType: "application/json",
			data: JSON.stringify(request),
			success: function(json) {
				Janus.debug("Message sent!");
				Janus.debug(json);
				if(json["janus"] === "success") {
					// We got a success, must have been a synchronous transaction
					var plugindata = json["plugindata"];
					if(plugindata === undefined || plugindata === null) {
						Janus.warn("Request succeeded, but missing plugindata...");
						callbacks.success();
						return;
					}
					Janus.log("Synchronous transaction successful (" + plugindata["plugin"] + ")");
					var data = plugindata["data"];
					Janus.debug(data);
					callbacks.success(data);
					return;
				} else if(json["janus"] !== "ack") {
					// Not a success and not an ack, must be an error
					if(json["error"] !== undefined && json["error"] !== null) {
						Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
						callbacks.error(json["error"].code + " " + json["error"].reason);
					} else {
						Janus.error("Unknown error");	// FIXME
						callbacks.error("Unknown error");
					}
					return;
				}
				// If we got here, the plugin decided to handle the request asynchronously
				callbacks.success();
			},
			error: function(XMLHttpRequest, textStatus, errorThrown) {
				Janus.error(textStatus + ": " + errorThrown);	// FIXME
				callbacks.error(textStatus + ": " + errorThrown);
			},
			dataType: "json"
		});
	}

	// Private method to send a trickle candidate
	function sendTrickleCandidate(handleId, candidate) {
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			return;
		}
		var request = { "janus": "trickle", "candidate": candidate, "transaction": randomString(12) };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		Janus.debug("Sending trickle candidate (handle=" + handleId + "):");
		Janus.debug(request);
		if(websockets) {
			request["session_id"] = sessionId;
			request["handle_id"] = handleId;
			ws.send(JSON.stringify(request));
			return;
		}
		$.ajax({
			type: 'POST',
			url: server + "/" + sessionId + "/" + handleId,
			cache: false,
			contentType: "application/json",
			data: JSON.stringify(request),
			success: function(json) {
				Janus.debug("Candidate sent!");
				Janus.debug(json);
				if(json["janus"] !== "ack") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
					return;
				}
			},
			error: function(XMLHttpRequest, textStatus, errorThrown) {
				Janus.error(textStatus + ": " + errorThrown);	// FIXME
			},
			dataType: "json"
		});
	}

	// Private method to send a data channel message
	function sendData(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		var text = callbacks.text;
		if(text === null || text === undefined) {
			Janus.warn("Invalid text");
			callbacks.error("Invalid text");
			return;
		}
		Janus.log("Sending string on data channel: " + text);
		config.dataChannel.send(text);
		callbacks.success();
	}

	// Private method to send a DTMF tone
	function sendDtmf(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		if(config.dtmfSender === null || config.dtmfSender === undefined) {
			// Create the DTMF sender, if possible
			if(config.myStream !== undefined && config.myStream !== null) {
				var tracks = config.myStream.getAudioTracks();
				if(tracks !== null && tracks !== undefined && tracks.length > 0) {
					var local_audio_track = tracks[0];
					config.dtmfSender = config.pc.createDTMFSender(local_audio_track);
					Janus.log("Created DTMF Sender");
					config.dtmfSender.ontonechange = function(tone) { Janus.debug("Sent DTMF tone: " + tone.tone); };
				}
			}
			if(config.dtmfSender === null || config.dtmfSender === undefined) {
				Janus.warn("Invalid DTMF configuration");
				callbacks.error("Invalid DTMF configuration");
				return;
			}
		}
		var dtmf = callbacks.dtmf;
		if(dtmf === null || dtmf === undefined) {
			Janus.warn("Invalid DTMF parameters");
			callbacks.error("Invalid DTMF parameters");
			return;
		}
		var tones = dtmf.tones;
		if(tones === null || tones === undefined) {
			Janus.warn("Invalid DTMF string");
			callbacks.error("Invalid DTMF string");
			return;
		}
		var duration = dtmf.duration;
		if(duration === null || duration === undefined)
			duration = 500;	// We choose 500ms as the default duration for a tone
		var gap = dtmf.gap;
		if(gap === null || gap === undefined)
			gap = 50;	// We choose 50ms as the default gap between tones
		Janus.debug("Sending DTMF string " + tones + " (duration " + duration + "ms, gap " + gap + "ms");
		config.dtmfSender.insertDTMF(tones, duration, gap);
	}

	// Private method to destroy a plugin handle
	function destroyHandle(handleId, callbacks, syncRequest) {
		syncRequest = (syncRequest === true);
		Janus.log("Destroying handle " + handleId + " (sync=" + syncRequest + ")");
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		cleanupWebrtc(handleId);
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.error("Is the gateway down? (connected=false)");
			return;
		}
		var request = { "janus": "detach", "transaction": randomString(12) };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		if(websockets) {
			request["session_id"] = sessionId;
			request["handle_id"] = handleId;
			ws.send(JSON.stringify(request));
			delete pluginHandles[handleId];
			callbacks.success();
			return;
		}
		$.ajax({
			type: 'POST',
			url: server + "/" + sessionId + "/" + handleId,
			async: syncRequest,	// Sometimes we need false here, or destroying in onbeforeunload won't work
			cache: false,
			contentType: "application/json",
			data: JSON.stringify(request),
			success: function(json) {
				Janus.log("Destroyed handle:");
				Janus.debug(json);
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
				}
				delete pluginHandles[handleId];
				callbacks.success();
			},
			error: function(XMLHttpRequest, textStatus, errorThrown) {
				Janus.error(textStatus + ": " + errorThrown);	// FIXME
				// We cleanup anyway
				delete pluginHandles[handleId];
				callbacks.success();
			},
			dataType: "json"
		});
	}

	// WebRTC stuff
	function streamsDone(handleId, jsep, media, callbacks, stream) {
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		Janus.debug("streamsDone:", stream);
		config.myStream = stream;
		var pc_config = {"iceServers": iceServers};
		//~ var pc_constraints = {'mandatory': {'MozDontOfferDataChannel':true}};
		var pc_constraints = {
			"optional": [{"DtlsSrtpKeyAgreement": true}]
		};
		if(ipv6Support === true) {
			// FIXME This is only supported in Chrome right now
			// For support in Firefox track this: https://bugzilla.mozilla.org/show_bug.cgi?id=797262
			pc_constraints.optional.push({"googIPv6":true});
		}
		Janus.log("Creating PeerConnection");
		Janus.debug(pc_constraints);
		config.pc = new RTCPeerConnection(pc_config, pc_constraints);
		Janus.debug(config.pc);
		if(config.pc.getStats) {	// FIXME
			config.volume.value = 0;
			config.bitrate.value = "0 kbits/sec";
		}
		Janus.log("Preparing local SDP and gathering candidates (trickle=" + config.trickle + ")");
		config.pc.onicecandidate = function(event) {
			if (event.candidate == null ||
					(webrtcDetectedBrowser === 'edge' && event.candidate.candidate.indexOf('endOfCandidates') > 0)) {
				Janus.log("End of candidates.");
				config.iceDone = true;
				if(config.trickle === true) {
					// Notify end of candidates
					sendTrickleCandidate(handleId, {"completed": true});
				} else {
					// No trickle, time to send the complete SDP (including all candidates)
					sendSDP(handleId, callbacks);
				}
			} else {
				// JSON.stringify doesn't work on some WebRTC objects anymore
				// See https://code.google.com/p/chromium/issues/detail?id=467366
				var candidate = {
					"candidate": event.candidate.candidate,
					"sdpMid": event.candidate.sdpMid,
					"sdpMLineIndex": event.candidate.sdpMLineIndex
				};
				Janus.debug("candidates: " + JSON.stringify(candidate));
				if(config.trickle === true) {
					// Send candidate
					sendTrickleCandidate(handleId, candidate);
				}
			}
		};
		if(stream !== null && stream !== undefined) {
			Janus.log('Adding local stream');
			config.pc.addStream(stream);
			pluginHandle.onlocalstream(stream);
		}
		config.pc.onaddstream = function(remoteStream) {
			Janus.log("Handling Remote Stream");
			Janus.debug(remoteStream);
			config.remoteStream = remoteStream;
			pluginHandle.onremotestream(remoteStream.stream);
		};
		// Any data channel to create?
		if(isDataEnabled(media)) {
			Janus.log("Creating data channel");
			var onDataChannelMessage = function(event) {
				Janus.log('Received message on data channel: ' + event.data);
				pluginHandle.ondata(event.data);	// FIXME
			}
			var onDataChannelStateChange = function() {
				var dcState = config.dataChannel !== null ? config.dataChannel.readyState : "null";
				Janus.log('State change on data channel: ' + dcState);
				if(dcState === 'open') {
					pluginHandle.ondataopen();	// FIXME
				}
			}
			var onDataChannelError = function(error) {
				Janus.error('Got error on data channel:', error);
				// TODO
			}
			// Until we implement the proxying of open requests within the Janus core, we open a channel ourselves whatever the case
			config.dataChannel = config.pc.createDataChannel("JanusDataChannel", {ordered:false});	// FIXME Add options (ordered, maxRetransmits, etc.)
			config.dataChannel.onmessage = onDataChannelMessage;
			config.dataChannel.onopen = onDataChannelStateChange;
			config.dataChannel.onclose = onDataChannelStateChange;
			config.dataChannel.onerror = onDataChannelError;
		}
		// Create offer/answer now
		if(jsep === null || jsep === undefined) {
			createOffer(handleId, media, callbacks);
		} else {
			config.pc.setRemoteDescription(
					new RTCSessionDescription(jsep),
					function() {
						Janus.log("Remote description accepted!");
						createAnswer(handleId, media, callbacks);
					}, callbacks.error);
		}
	}

	function prepareWebrtc(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : webrtcError;
		var jsep = callbacks.jsep;
		var media = callbacks.media;
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		// Are we updating a session?
		if(config.pc !== undefined && config.pc !== null) {
			Janus.log("Updating existing media session");
			// Create offer/answer now
			if(jsep === null || jsep === undefined) {
				createOffer(handleId, media, callbacks);
			} else {
				config.pc.setRemoteDescription(
						new RTCSessionDescription(jsep),
						function() {
							Janus.log("Remote description accepted!");
							createAnswer(handleId, media, callbacks);
						}, callbacks.error);
			}
			return;
		}
		// Was a MediaStream object passed, or do we need to take care of that?
		if(callbacks.stream !== null && callbacks.stream !== undefined) {
			var stream = callbacks.stream;
			Janus.log("MediaStream provided by the application");
			Janus.debug(stream);
			// Skip the getUserMedia part
			config.streamExternal = true;
			streamsDone(handleId, jsep, media, callbacks, stream);
			return;
		}
		config.trickle = isTrickleEnabled(callbacks.trickle);
		if(isAudioSendEnabled(media) || isVideoSendEnabled(media)) {
			var constraints = { mandatory: {}, optional: []};
			pluginHandle.consentDialog(true);
			var videoSupport = isVideoSendEnabled(media);
			if(videoSupport === true && media != undefined && media != null) {
				if(media.video && media.video != 'screen') {
					var width = 0;
					var height = 0, maxHeight = 0;
					if(media.video === 'lowres') {
						// Small resolution, 4:3
						height = 240;
						maxHeight = 240;
						width = 320;
					} else if(media.video === 'lowres-16:9') {
						// Small resolution, 16:9
						height = 180;
						maxHeight = 180;
						width = 320;
					} else if(media.video === 'hires' || media.video === 'hires-16:9' ) {
						// High resolution is only 16:9
						height = 720;
						maxHeight = 720;
						width = 1280;
						if(navigator.mozGetUserMedia) {
							var firefoxVer = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
							if(firefoxVer < 38) {
								// Unless this is and old Firefox, which doesn't support it
								Janus.warn(media.video + " unsupported, falling back to stdres (old Firefox)");
								height = 480;
								maxHeight = 480;
								width  = 640;
							}
						}
					} else if(media.video === 'stdres') {
						// Normal resolution, 4:3
						height = 480;
						maxHeight = 480;
						width  = 640;
					} else if(media.video === 'stdres-16:9') {
						// Normal resolution, 16:9
						height = 360;
						maxHeight = 360;
						width = 640;
					} else {
						Janus.log("Default video setting (" + media.video + ") is stdres 4:3");
						height = 480;
						maxHeight = 480;
						width = 640;
					}
					Janus.log("Adding media constraint " + media.video);
					if(navigator.mozGetUserMedia) {
						var firefoxVer = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
						if(firefoxVer < 38) {
							videoSupport = {
								'require': ['height', 'width'],
								'height': {'max': maxHeight, 'min': height},
								'width':  {'max': width,  'min': width}
							};
						} else {
							// http://stackoverflow.com/questions/28282385/webrtc-firefox-constraints/28911694#28911694
							// https://github.com/meetecho/janus-gateway/pull/246
							videoSupport = {
								'height': {'ideal': height},
								'width':  {'ideal': width}
							};
						}
					} else {
						videoSupport = {
						    'mandatory': {
						        'maxHeight': maxHeight,
						        'minHeight': height,
						        'maxWidth':  width,
						        'minWidth':  width
						    },
						    'optional': []
						};
					}
					Janus.debug(videoSupport);
				} else if(media.video === 'screen') {
					// Not a webcam, but screen capture
					if(window.location.protocol !== 'https:') {
						// Screen sharing mandates HTTPS
						Janus.warn("Screen sharing only works on HTTPS, try the https:// version of this page");
						pluginHandle.consentDialog(false);
						callbacks.error("Screen sharing only works on HTTPS, try the https:// version of this page");
						return;
					}
					// We're going to try and use the extension for Chrome 34+, the old approach
					// for older versions of Chrome, or the experimental support in Firefox 33+
					var cache = {};
					function callbackUserMedia (error, stream) {
						pluginHandle.consentDialog(false);
						if(error) {
							callbacks.error(error);
						} else {
							streamsDone(handleId, jsep, media, callbacks, stream);
						}
					};
					function getScreenMedia(constraints, gsmCallback) {
						Janus.log("Adding media constraint (screen capture)");
						Janus.debug(constraints);
						getUserMedia(constraints,
							function(stream) {
								gsmCallback(null, stream);
							},
							function(error) {
								pluginHandle.consentDialog(false);
								gsmCallback(error);
							}
						);
					};
					if(window.navigator.userAgent.match('Chrome')) {
						var chromever = parseInt(window.navigator.userAgent.match(/Chrome\/(.*) /)[1], 10);
						var maxver = 33;
						if(window.navigator.userAgent.match('Linux'))
							maxver = 35;	// "known" crash in chrome 34 and 35 on linux
						if(chromever >= 26 && chromever <= maxver) {
							// Chrome 26->33 requires some awkward chrome://flags manipulation
							constraints = {
								video: {
									mandatory: {
										googLeakyBucket: true,
										maxWidth: window.screen.width,
										maxHeight: window.screen.height,
										maxFrameRate: 3,
										chromeMediaSource: 'screen'
									}
								},
								audio: isAudioSendEnabled(media)
							};
							getScreenMedia(constraints, callbackUserMedia);
						} else {
							// Chrome 34+ requires an extension
							var pending = window.setTimeout(
								function () {
									error = new Error('NavigatorUserMediaError');
									error.name = 'The required Chrome extension is not installed: click <a href="#">here</a> to install it. (NOTE: this will need you to refresh the page)';
									pluginHandle.consentDialog(false);
									return callbacks.error(error);
								}, 1000);
							cache[pending] = [callbackUserMedia, null];
							window.postMessage({ type: 'janusGetScreen', id: pending }, '*');
						}
					} else if (window.navigator.userAgent.match('Firefox')) {
						var ffver = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
						if(ffver >= 33) {
							// Firefox 33+ has experimental support for screen sharing
							constraints = {
								video: {
									mozMediaSource: 'window',
									mediaSource: 'window'
								},
								audio: isAudioSendEnabled(media)
							};
							getScreenMedia(constraints, function (err, stream) {
								callbackUserMedia(err, stream);
								// Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1045810
								if (!err) {
									var lastTime = stream.currentTime;
									var polly = window.setInterval(function () {
										if(!stream)
											window.clearInterval(polly);
										if(stream.currentTime == lastTime) {
											window.clearInterval(polly);
											if(stream.onended) {
												stream.onended();
											}
										}
										lastTime = stream.currentTime;
									}, 500);
								}
							});
						} else {
							var error = new Error('NavigatorUserMediaError');
							error.name = 'Your version of Firefox does not support screen sharing, please install Firefox 33 (or more recent versions)';
							pluginHandle.consentDialog(false);
							callbacks.error(error);
							return;
						}
					}

					// Wait for events from the Chrome Extension
					window.addEventListener('message', function (event) {
						if(event.origin != window.location.origin)
							return;
						if(event.data.type == 'janusGotScreen' && cache[event.data.id]) {
							var data = cache[event.data.id];
							var callback = data[0];
							delete cache[event.data.id];

							if (event.data.sourceId === '') {
								// user canceled
								var error = new Error('NavigatorUserMediaError');
								error.name = 'You cancelled the request for permission, giving up...';
								pluginHandle.consentDialog(false);
								callbacks.error(error);
							} else {
								constraints = {
									audio: isAudioSendEnabled(media),
									video: {
										mandatory: {
										chromeMediaSource: 'desktop',
										maxWidth: window.screen.width,
										maxHeight: window.screen.height,
										maxFrameRate: 3
									},
									optional: [
										{googLeakyBucket: true},
										{googTemporalLayeredScreencast: true}
									]
								}};
								constraints.video.mandatory.chromeMediaSourceId = event.data.sourceId;
								getScreenMedia(constraints, callback);
							}
						} else if (event.data.type == 'janusGetScreenPending') {
							window.clearTimeout(event.data.id);
						}
					});
				}
			}
			// If we got here, we're not screensharing
			if(media === null || media === undefined || media.video !== 'screen') {
				// Check whether all media sources are actually available or not
				// as per https://github.com/meetecho/janus-gateway/pull/114
                                haveSources = function(sources) {
					var audioExist = sources.some(function(source) {
						return source.kind === 'audio';
					}),
					videoExist = sources.some(function(source) {
						return source.kind === 'video';
					});

					// Check whether a missing device is really a problem
					var audioSend = isAudioSendEnabled(media);
					var videoSend = isVideoSendEnabled(media);
					if(audioSend || videoSend) {
						// We need to send either audio or video
						var haveAudioDevice = audioSend ? audioExist : false;
						var haveVideoDevice = videoSend ? videoExist : false;
						if(!haveAudioDevice && !haveVideoDevice) {
							// FIXME Should we really give up, or just assume recvonly for both?
							pluginHandle.consentDialog(false);
							callbacks.error('No capture device found');
							return false;
						}
					}

					getUserMedia(
						{audio: audioExist && audioSend, video: videoExist && videoSend ? videoSupport : false},
						function(stream) { pluginHandle.consentDialog(false); streamsDone(handleId, jsep, media, callbacks, stream); },
						function(error) { pluginHandle.consentDialog(false); callbacks.error({code: error.code, name: error.name, message: error.message}); });
				};

                                if (navigator.mediaDevices.enumerateDevices != null)
				{
					navigator.mediaDevices.enumerateDevices().then(function(devices){
						sources = [];
						devices.forEach(function(device){
							if (device.kind.match(/input/))
							{
								kind = 'video'
								if (device.kind.match(/audio/)) { kind = 'audio' }
								sources.push({
									'id': device.deviceId,
									'kind': kind,
									'label': device.label
								});
							}
						});
						haveSources(sources);
					});
				}
				else
				{
					MediaStreamTrack.getSources(haveSources);
				}


			}
		} else {
			// No need to do a getUserMedia, create offer/answer right away
			streamsDone(handleId, jsep, media, callbacks);
		}
	}

	function prepareWebrtcPeer(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : webrtcError;
		var jsep = callbacks.jsep;
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		if(jsep !== undefined && jsep !== null) {
			if(config.pc === null) {
				Janus.warn("Wait, no PeerConnection?? if this is an answer, use createAnswer and not handleRemoteJsep");
				callbacks.error("No PeerConnection: if this is an answer, use createAnswer and not handleRemoteJsep");
				return;
			}
			config.pc.setRemoteDescription(
					new RTCSessionDescription(jsep),
					function() {
						Janus.log("Remote description accepted!");
						callbacks.success();
					}, callbacks.error);
		} else {
			callbacks.error("Invalid JSEP");
		}
	}

	function createOffer(handleId, media, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		Janus.log("Creating offer (iceDone=" + config.iceDone + ")");
		// https://code.google.com/p/webrtc/issues/detail?id=3508
		var mediaConstraints = null;
		if(webrtcDetectedBrowser == "firefox" || webrtcDetectedBrowser == "edge") {
			mediaConstraints = {
				'offerToReceiveAudio':isAudioRecvEnabled(media),
				'offerToReceiveVideo':isVideoRecvEnabled(media)
			};
		} else {
			mediaConstraints = {
				'mandatory': {
					'OfferToReceiveAudio':isAudioRecvEnabled(media),
					'OfferToReceiveVideo':isVideoRecvEnabled(media)
				}
			};
		}
		Janus.debug(mediaConstraints);
		config.pc.createOffer(
			function(offer) {
				Janus.debug(offer);
				if(config.mySdp === null || config.mySdp === undefined) {
					Janus.log("Setting local description");
					config.mySdp = offer.sdp;
					config.pc.setLocalDescription(offer);
				}
				if(!config.iceDone && !config.trickle) {
					// Don't do anything until we have all candidates
					Janus.log("Waiting for all candidates...");
					return;
				}
				if(config.sdpSent) {
					Janus.log("Offer already sent, not sending it again");
					return;
				}
				Janus.log("Offer ready");
				Janus.debug(callbacks);
				config.sdpSent = true;
				// JSON.stringify doesn't work on some WebRTC objects anymore
				// See https://code.google.com/p/chromium/issues/detail?id=467366
				var jsep = {
					"type": offer.type,
					"sdp": offer.sdp
				};
				callbacks.success(jsep);
			}, callbacks.error, mediaConstraints);
	}

	function createAnswer(handleId, media, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		Janus.log("Creating answer (iceDone=" + config.iceDone + ")");
		var mediaConstraints = null;
		if(webrtcDetectedBrowser == "firefox" || webrtcDetectedBrowser == "edge") {
			mediaConstraints = {
				'offerToReceiveAudio':isAudioRecvEnabled(media),
				'offerToReceiveVideo':isVideoRecvEnabled(media)
			};
		} else {
			mediaConstraints = {
				'mandatory': {
					'OfferToReceiveAudio':isAudioRecvEnabled(media),
					'OfferToReceiveVideo':isVideoRecvEnabled(media)
				}
			};
		}
		Janus.debug(mediaConstraints);
		config.pc.createAnswer(
			function(answer) {
				Janus.debug(answer);
				if(config.mySdp === null || config.mySdp === undefined) {
					Janus.log("Setting local description");
					config.mySdp = answer.sdp;
					config.pc.setLocalDescription(answer);
				}
				if(!config.iceDone && !config.trickle) {
					// Don't do anything until we have all candidates
					Janus.log("Waiting for all candidates...");
					return;
				}
				if(config.sdpSent) {	// FIXME badly
					Janus.log("Answer already sent, not sending it again");
					return;
				}
				config.sdpSent = true;
				// JSON.stringify doesn't work on some WebRTC objects anymore
				// See https://code.google.com/p/chromium/issues/detail?id=467366
				var jsep = {
					"type": answer.type,
					"sdp": answer.sdp
				};
				callbacks.success(jsep);
			}, callbacks.error, mediaConstraints);
	}

	function sendSDP(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : jQuery.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : jQuery.noop;
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle, not sending anything");
			return;
		}
		var config = pluginHandle.webrtcStuff;
		Janus.log("Sending offer/answer SDP...");
		if(config.mySdp === null || config.mySdp === undefined) {
			Janus.warn("Local SDP instance is invalid, not sending anything...");
			return;
		}
		config.mySdp = {
			"type": config.pc.localDescription.type,
			"sdp": config.pc.localDescription.sdp
		};
		if(config.sdpSent) {
			Janus.log("Offer/Answer SDP already sent, not sending it again");
			return;
		}
		if(config.trickle === false)
			config.mySdp["trickle"] = false;
		Janus.debug(callbacks);
		config.sdpSent = true;
		callbacks.success(config.mySdp);
	}

	function getVolume(handleId) {
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			return 0;
		}
		var config = pluginHandle.webrtcStuff;
		// Start getting the volume, if getStats is supported
		if(config.pc.getStats && webrtcDetectedBrowser == "chrome") {	// FIXME
			if(config.remoteStream === null || config.remoteStream === undefined) {
				Janus.warn("Remote stream unavailable");
				return 0;
			}
			// http://webrtc.googlecode.com/svn/trunk/samples/js/demos/html/constraints-and-stats.html
			if(config.volume.timer === null || config.volume.timer === undefined) {
				Janus.log("Starting volume monitor");
				config.volume.timer = setInterval(function() {
					config.pc.getStats(function(stats) {
						var results = stats.result();
						for(var i=0; i<results.length; i++) {
							var res = results[i];
							if(res.type == 'ssrc' && res.stat('audioOutputLevel')) {
								config.volume.value = res.stat('audioOutputLevel');
							}
						}
					});
				}, 200);
				return 0;	// We don't have a volume to return yet
			}
			return config.volume.value;
		} else {
			Janus.log("Getting the remote volume unsupported by browser");
			return 0;
		}
	}

	function isMuted(handleId, video) {
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			return true;
		}
		var config = pluginHandle.webrtcStuff;
		if(config.pc === null || config.pc === undefined) {
			Janus.warn("Invalid PeerConnection");
			return true;
		}
		if(config.myStream === undefined || config.myStream === null) {
			Janus.warn("Invalid local MediaStream");
			return true;
		}
		if(video) {
			// Check video track
			if(config.myStream.getVideoTracks() === null
					|| config.myStream.getVideoTracks() === undefined
					|| config.myStream.getVideoTracks().length === 0) {
				Janus.warn("No video track");
				return true;
			}
			return !config.myStream.getVideoTracks()[0].enabled;
		} else {
			// Check audio track
			if(config.myStream.getAudioTracks() === null
					|| config.myStream.getAudioTracks() === undefined
					|| config.myStream.getAudioTracks().length === 0) {
				Janus.warn("No audio track");
				return true;
			}
			return !config.myStream.getAudioTracks()[0].enabled;
		}
	}

	function mute(handleId, video, mute) {
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			return false;
		}
		var config = pluginHandle.webrtcStuff;
		if(config.pc === null || config.pc === undefined) {
			Janus.warn("Invalid PeerConnection");
			return false;
		}
		if(config.myStream === undefined || config.myStream === null) {
			Janus.warn("Invalid local MediaStream");
			return false;
		}
		if(video) {
			// Mute/unmute video track
			if(config.myStream.getVideoTracks() === null
					|| config.myStream.getVideoTracks() === undefined
					|| config.myStream.getVideoTracks().length === 0) {
				Janus.warn("No video track");
				return false;
			}
			config.myStream.getVideoTracks()[0].enabled = mute ? false : true;
			return true;
		} else {
			// Mute/unmute audio track
			if(config.myStream.getAudioTracks() === null
					|| config.myStream.getAudioTracks() === undefined
					|| config.myStream.getAudioTracks().length === 0) {
				Janus.warn("No audio track");
				return false;
			}
			config.myStream.getAudioTracks()[0].enabled = mute ? false : true;
			return true;
		}
	}

	function getBitrate(handleId) {
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			return "Invalid handle";
		}
		var config = pluginHandle.webrtcStuff;
		if(config.pc === null || config.pc === undefined)
			return "Invalid PeerConnection";
		// Start getting the bitrate, if getStats is supported
		if(config.pc.getStats && webrtcDetectedBrowser == "chrome") {
			// Do it the Chrome way
			if(config.remoteStream === null || config.remoteStream === undefined) {
				Janus.warn("Remote stream unavailable");
				return "Remote stream unavailable";
			}
			// http://webrtc.googlecode.com/svn/trunk/samples/js/demos/html/constraints-and-stats.html
			if(config.bitrate.timer === null || config.bitrate.timer === undefined) {
				Janus.log("Starting bitrate timer (Chrome)");
				config.bitrate.timer = setInterval(function() {
					config.pc.getStats(function(stats) {
						var results = stats.result();
						for(var i=0; i<results.length; i++) {
							var res = results[i];
							if(res.type == 'ssrc' && res.stat('googFrameHeightReceived')) {
								config.bitrate.bsnow = res.stat('bytesReceived');
								config.bitrate.tsnow = res.timestamp;
								if(config.bitrate.bsbefore === null || config.bitrate.tsbefore === null) {
									// Skip this round
									config.bitrate.bsbefore = config.bitrate.bsnow;
									config.bitrate.tsbefore = config.bitrate.tsnow;
								} else {
									// Calculate bitrate
									var bitRate = Math.round((config.bitrate.bsnow - config.bitrate.bsbefore) * 8 / (config.bitrate.tsnow - config.bitrate.tsbefore));
									config.bitrate.value = bitRate + ' kbits/sec';
									//~ Janus.log("Estimated bitrate is " + config.bitrate.value);
									config.bitrate.bsbefore = config.bitrate.bsnow;
									config.bitrate.tsbefore = config.bitrate.tsnow;
								}
							}
						}
					});
				}, 1000);
				return "0 kbits/sec";	// We don't have a bitrate value yet
			}
			return config.bitrate.value;
		} else if(config.pc.getStats && webrtcDetectedBrowser == "firefox") {
			// Do it the Firefox way
			if(config.remoteStream === null || config.remoteStream === undefined
					|| config.remoteStream.stream === null || config.remoteStream.stream === undefined) {
				Janus.warn("Remote stream unavailable");
				return "Remote stream unavailable";
			}
			var videoTracks = config.remoteStream.stream.getVideoTracks();
			if(videoTracks === null || videoTracks === undefined || videoTracks.length < 1) {
				Janus.warn("No video track");
				return "No video track";
			}
			// https://github.com/muaz-khan/getStats/blob/master/getStats.js
			if(config.bitrate.timer === null || config.bitrate.timer === undefined) {
				Janus.log("Starting bitrate timer (Firefox)");
				config.bitrate.timer = setInterval(function() {
					// We need a helper callback
					var cb = function(res) {
						if(res === null || res === undefined ||
								res.inbound_rtp_video_1 == null || res.inbound_rtp_video_1 == null) {
							config.bitrate.value = "Missing inbound_rtp_video_1";
							return;
						}
						config.bitrate.bsnow = res.inbound_rtp_video_1.bytesReceived;
						config.bitrate.tsnow = res.inbound_rtp_video_1.timestamp;
						if(config.bitrate.bsbefore === null || config.bitrate.tsbefore === null) {
							// Skip this round
							config.bitrate.bsbefore = config.bitrate.bsnow;
							config.bitrate.tsbefore = config.bitrate.tsnow;
						} else {
							// Calculate bitrate
							var bitRate = Math.round((config.bitrate.bsnow - config.bitrate.bsbefore) * 8 / (config.bitrate.tsnow - config.bitrate.tsbefore));
							config.bitrate.value = bitRate + ' kbits/sec';
							config.bitrate.bsbefore = config.bitrate.bsnow;
							config.bitrate.tsbefore = config.bitrate.tsnow;
						}
					};
					// Actually get the stats
					config.pc.getStats(videoTracks[0], function(stats) {
						cb(stats);
					}, cb);
				}, 1000);
				return "0 kbits/sec";	// We don't have a bitrate value yet
			}
			return config.bitrate.value;
		} else {
			Janus.warn("Getting the video bitrate unsupported by browser");
			return "Feature unsupported by browser";
		}
	}

	function webrtcError(error) {
		Janus.error("WebRTC error:", error);
	}

	function cleanupWebrtc(handleId, hangupRequest) {
		Janus.log("Cleaning WebRTC stuff");
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined) {
			// Nothing to clean
			return;
		}
		var config = pluginHandle.webrtcStuff;
		if(config !== null && config !== undefined) {
			if(hangupRequest === true) {
				// Send a hangup request (we don't really care about the response)
				var request = { "janus": "hangup", "transaction": randomString(12) };
				if(token !== null && token !== undefined)
					request["token"] = token;
				if(apisecret !== null && apisecret !== undefined)
					request["apisecret"] = apisecret;
				Janus.debug("Sending hangup request (handle=" + handleId + "):");
				Janus.debug(request);
				if(websockets) {
					request["session_id"] = sessionId;
					request["handle_id"] = handleId;
					ws.send(JSON.stringify(request));
				} else {
					$.ajax({
						type: 'POST',
						url: server + "/" + sessionId + "/" + handleId,
						cache: false,
						contentType: "application/json",
						data: JSON.stringify(request),
						dataType: "json"
					});
				}
			}
			// Cleanup stack
			config.remoteStream = null;
			if(config.volume.timer)
				clearInterval(config.volume.timer);
			config.volume.value = null;
			if(config.bitrate.timer)
				clearInterval(config.bitrate.timer);
			config.bitrate.timer = null;
			config.bitrate.bsnow = null;
			config.bitrate.bsbefore = null;
			config.bitrate.tsnow = null;
			config.bitrate.tsbefore = null;
			config.bitrate.value = null;
			try {
				// Try a MediaStream.stop() first
				if(!config.streamExternal && config.myStream !== null && config.myStream !== undefined) {
					Janus.log("Stopping local stream");
					config.myStream.stop();
				}
			} catch(e) {
				// Do nothing if this fails
			}
			try {
				// Try a MediaStreamTrack.stop() for each track as well
				if(!config.streamExternal && config.myStream !== null && config.myStream !== undefined) {
					Janus.log("Stopping local stream tracks");
					var tracks = config.myStream.getTracks();
					for(var i in tracks) {
						var mst = tracks[i];
						Janus.log(mst);
						if(mst !== null && mst !== undefined)
							mst.stop();
					}
				}
			} catch(e) {
				// Do nothing if this fails
			}
			config.streamExternal = false;
			config.myStream = null;
			// Close PeerConnection
			try {
				config.pc.close();
			} catch(e) {
				// Do nothing
			}
			config.pc = null;
			config.mySdp = null;
			config.iceDone = false;
			config.sdpSent = false;
			config.dataChannel = null;
			config.dtmfSender = null;
		}
		pluginHandle.oncleanup();
	}

	// Helper methods to parse a media object
	function isAudioSendEnabled(media) {
		Janus.debug("isAudioSendEnabled:", media);
		if(media === undefined || media === null)
			return true;	// Default
		if(media.audio === false)
			return false;	// Generic audio has precedence
		if(media.audioSend === undefined || media.audioSend === null)
			return true;	// Default
		return (media.audioSend === true);
	}

	function isAudioRecvEnabled(media) {
		Janus.debug("isAudioRecvEnabled:", media);
		if(media === undefined || media === null)
			return true;	// Default
		if(media.audio === false)
			return false;	// Generic audio has precedence
		if(media.audioRecv === undefined || media.audioRecv === null)
			return true;	// Default
		return (media.audioRecv === true);
	}

	function isVideoSendEnabled(media) {
		Janus.debug("isVideoSendEnabled:", media);
		if(webrtcDetectedBrowser == "edge") {
			Janus.warn("Edge doesn't support compatible video yet");
			return false;
		}
		if(media === undefined || media === null)
			return true;	// Default
		if(media.video === false)
			return false;	// Generic video has precedence
		if(media.videoSend === undefined || media.videoSend === null)
			return true;	// Default
		return (media.videoSend === true);
	}

	function isVideoRecvEnabled(media) {
		Janus.debug("isVideoRecvEnabled:", media);
		if(webrtcDetectedBrowser == "edge") {
			Janus.warn("Edge doesn't support compatible video yet");
			return false;
		}
		if(media === undefined || media === null)
			return true;	// Default
		if(media.video === false)
			return false;	// Generic video has precedence
		if(media.videoRecv === undefined || media.videoRecv === null)
			return true;	// Default
		return (media.videoRecv === true);
	}

	function isDataEnabled(media) {
		Janus.debug("isDataEnabled:", media);
		if(webrtcDetectedBrowser == "edge") {
			Janus.warn("Edge doesn't support data channels yet");
			return false;
		}
		if(media === undefined || media === null)
			return false;	// Default
		return (media.data === true);
	}

	function isTrickleEnabled(trickle) {
		Janus.debug("isTrickleEnabled:", trickle);
		if(trickle === undefined || trickle === null)
			return true;	// Default is true
		return (trickle === true);
	}
};
