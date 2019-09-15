const Minipass = require('minipass')
const EE = require('events')
const isStream = s => s && s instanceof EE && typeof s.pipe === 'function'

const _streams = Symbol('_streams')
const _head = Symbol('_head')
const _tail = Symbol('_tail')
class Pipeline extends Minipass {
  constructor (opts, ...streams) {
    if (isStream(opts) && Array.isArray(streams)) {
      streams.unshift(opts)
      opts = {}
    }

    if (!streams || !streams.length)
      throw new Error('cannot create pipeline without 1 or more streams')

    super(opts)
    this[_streams] = streams

    this[_head] = streams[0]
    this[_tail] = streams[streams.length - 1]
    if (this[_streams].length > 1) {
      for (let i = 0; i < streams.length - 1; i++) {
        streams[i].pipe(streams[i + 1])
        streams[i].on('error', er => streams[i + 1].emit('error', er))
      }
    }
    this[_tail].on('error', er => this.emit('error', er))
    this[_tail].on('data', c => super.write(c))
    this[_tail].on('end', c => super.end())
    this[_head].on('drain', c => this.emit('drain'))
  }

  pause () {
    return this[_tail].pause()
  }

  resume () {
    return this[_tail].resume()
  }

  write (chunk, enc) {
    return this[_head].write(chunk, enc)
  }

  end (chunk, enc) {
    this[_head].end(chunk, enc)
    return this
  }
}

module.exports = Pipeline
