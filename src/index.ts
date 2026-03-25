import { Minipass } from 'minipass'
import type Stream from 'node:stream'


export type MinipassPipelineOptions<R> = Minipass.Options<R> & {}

const hasDestroyMethod = <T extends {}>(s: T): s is T & { destroy: () => void } =>
  ('destroy' in s) && typeof s.destroy === 'function'

export class Pipeline<R> extends Minipass<R, R, Minipass.Events<R>> {
  #streams: (Stream | Minipass)[] = []
  #tail?: (Stream | Minipass)
  #head?: (Stream | Minipass)

  constructor (opts: MinipassPipelineOptions<R>, ...streams: (Minipass | Stream)[]) {
    //oxlint-disable-next-line ban-ts-comment
    //@ts-ignore type inference puzzle for another day
    super(opts)
    if (streams.length)
      this.push(...streams)
  }

  #linkStreams (streams: (Stream | Minipass)[]) {
    // reduce takes (left,right), and we return right to make it the
    // new left value.
    return streams.reduce((src, dest) => {
      const s = src as Minipass
      const d = dest as Minipass
      s.on('error', er => d.emit('error', er))
      s.pipe(d)
      return dest
    })
  }

  push (...streams: (Stream | Minipass)[]) {
    this.#streams.push(...streams)
    if (this.#tail)
      streams.unshift(this.#tail)

    const linkRet = this.#linkStreams(streams)

    this.#setTail(linkRet)
    if (!this.#head)
      this.#setHead(streams[0] as Minipass)
  }

  unshift (...streams: (Stream | Minipass)[]) {
    this.#streams.unshift(...streams)
    if (this.#head)
      streams.push(this.#head)

    const linkRet = this.#linkStreams(streams)
    this.#setHead(streams[0] as Minipass)
    if (!this.#tail)
      this.#setTail(linkRet)
  }

  destroy (er?: Error) {
    // set fire to the whole thing.
    this.#streams.forEach(s =>
      hasDestroyMethod(s) && s.destroy())
    return super.destroy(er)
  }

  // readable interface -> tail
  #setTail (stream: Stream | Minipass) {
    const s = stream as Stream
    this.#tail = stream
    s.on('error', er => this.#onError(stream, er))
    s.on('data', chunk => this.#onData(stream, chunk))
    s.on('end', () => this.#onEnd(stream))
    s.on('finish', () => this.#onEnd(stream))
  }

  // errors proxied down the pipeline
  // they're considered part of the "read" interface
  #onError (stream: Stream | Minipass, er: unknown) {
    if (stream === this.#tail)
      this.emit('error', er)
  }
  #onData (stream: Stream | Minipass, chunk: R) {
    if (stream === this.#tail) {
      //oxlint-disable-next-line ban-ts-comment
      //@ts-ignore type inference puzzle for another day
      super.write(chunk)
    }
  }
  #onEnd (stream: Stream | Minipass) {
    if (stream === this.#tail)
      super.end()
  }
  pause () {
    super.pause()
    const t = this.#tail as Minipass
    if (t && t.pause) t.pause()
  }

  // NB: Minipass calls its internal private [RESUME] method during
  // pipe drains, to avoid hazards where stream.resume() is overridden.
  // Thus, we need to listen to the resume *event*, not override the
  // resume() method, and proxy *that* to the tail.
  emit <Event extends keyof Minipass.Events<R>>(ev: Event, ...args: Minipass.Events<R>[Event]) {
    const t = this.#tail as Minipass
    if (ev === 'resume' && t && t.resume)
      t.resume()
    return super.emit(ev, ...args)
  }

  // writable interface -> head
  #setHead (stream: Stream | Minipass) {
    const s = stream as Minipass
    this.#head = s
    s.on('drain', () => this.#onDrain(s))
  }
  #onDrain (stream: Stream | Minipass) {
    if (stream === this.#head)
      this.emit('drain')
  }
  write(
    chunk: R,
    enc?: Minipass.Encoding | (() => void),
    cb?: () => void
  ): boolean {
    //oxlint-disable-next-line ban-ts-comment
    //@ts-ignore type inference puzzle for another day
    return (this.#head as Minipass).write(chunk, enc, cb) &&
      (this.flowing || this.bufferLength === 0)
  }
  end (chunk?: R | Minipass.Encoding | (() => void), enc?: Minipass.Encoding | (() => void), cb?: () => void) {
    //oxlint-disable-next-line ban-ts-comment
    //@ts-ignore type inference puzzle for another day
    this.#head.end(chunk, enc, cb)
    return this
  }
}
