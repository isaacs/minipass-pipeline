const Minipass = require('minipass')
const EE = require('events')
const isStream = s => s && s instanceof EE && typeof s.pipe === 'function'

const _head = Symbol('_head')
const _tail = Symbol('_tail')
const _linkStreams = Symbol('_linkStreams')
const _setHead = Symbol('_setHead')
const _setTail = Symbol('_setTail')
const _onError = Symbol('_onError')
const _onData = Symbol('_onData')
const _onEnd = Symbol('_onEnd')
const _onDrain = Symbol('_onDrain')
class Pipeline extends Minipass {
  constructor (opts, ...streams) {
    if (isStream(opts)) {
      streams.unshift(opts)
      opts = {}
    }

    super(opts)
    if (streams.length)
      this.push(...streams)
  }

  [_linkStreams] (...streams) {
    // reduce takes (left,right), and we return right to make it the
    // new left value.  returns the tail.  filter out null so we
    // can pass the head/tail in even when they're not set yet.
    return streams.filter(isStream).reduce((src, dest) =>
      src.on('error', er => dest.emit('error', er)).pipe(dest))
  }

  push (...streams) {
    this[_setTail](this[_linkStreams](this[_tail], ...streams))
  }

  unshift (...streams) {
    this[_linkStreams](...streams, this[_head])
    this[_setHead](streams.find(isStream))
  }

  // readable interface -> tail
  [_setTail] (stream) {
    this[_tail] = stream
    stream.on('error', er => this[_onError](stream, er))
    stream.on('data', chunk => this[_onData](stream, chunk))
    stream.on('end', () => this[_onEnd](stream))
    if (!this[_head])
      this[_setHead](stream)
  }

  // errors proxied down the pipeline
  // they're considered part of the "read" interface
  [_onError] (stream, er) {
    if (stream === this[_tail])
      this.emit('error', er)
  }
  [_onData] (stream, chunk) {
    if (stream === this[_tail])
      super.write(chunk)
  }
  [_onEnd] (stream) {
    if (stream === this[_tail])
      super.end()
  }
  pause () {
    return this[_tail].pause()
  }
  resume () {
    return this[_tail].resume()
  }

  // writable interface -> head
  [_setHead] (stream) {
    this[_head] = stream
    stream.on('drain', () => this[_onDrain](stream))
    if (!this[_tail])
      this[_setTail](stream)
  }
  [_onDrain] (stream) {
    if (stream === this[_head])
      this.emit('drain')
  }
  write (chunk, enc, cb) {
    return this[_head].write(chunk, enc, cb)
  }
  end (chunk, enc, cb) {
    this[_head].end(chunk, enc, cb)
    return this
  }
}

module.exports = Pipeline
