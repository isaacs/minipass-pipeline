const Pipeline = require('../')
const { Minipass } = require('minipass')
const t = require('tap')

t.test('wrap some streams', t => {
  const specifyOpts = [true, false]
  const s1 = new Minipass()
  const s2 = new Minipass()
  const s3 = new Minipass()
  const s4 = new Minipass()

  const p = new Pipeline({})

  p.unshift(s2)
  p.push(s3, s4)
  p.unshift(s1)
  p.setEncoding('utf8')

  const buf = []
  p.on('data', c => buf.push(c))
  p.on('end', () => {
    t.matchSnapshot(buf, 'got expected data')
    t.ok(gotError, 'got error as expected')
    t.end()
  })
  p.write('written to pipeline')

  let gotError = false
  p.on('error', er => {
    gotError = true
    t.equal(er, poop, 'got expected error')
  })

  s1.write('emitted by 1')
  p.pause()
  t.notOk(s2.write('emitted by 2'), 'write() returns false when paused')
  p.resume()
  t.ok(s3.write('emitted by 3'), 'write() returns true when flowing')
  const poop = new Error('poop')
  s2.emit('error', poop)

  p.end('ending pipeline')
})

t.test('single stream pipeline just wraps', t => {
  const s1 = new Minipass()

  const p = new Pipeline(s1)
  p.setEncoding('utf8')

  const buf = []
  p.on('data', c => buf.push(c))
  p.on('end', () => {
    t.matchSnapshot(buf, 'got expected data')
    t.end()
  })
  p.write('written to pipeline')

  s1.write('emitted by 1')
  p.pause()
  t.notOk(s1.write('emitted by 2'), 'write() returns false when paused')
  p.resume()
  t.ok(s1.write('emitted by 3'), 'write() returns true when flowing')

  p.end('ending pipeline')
})

t.test('pipeline to a writable that is not readable', t => {
  const EE = require('events')
  const buf = []
  const writable = new (class extends EE {
    constructor () {
      super()
      this.readable = false
      this.writable = true
    }
    write (chunk) {
      buf.push(chunk)
      return true
    }
    end (chunk) {
      this.emit('prefinish')
      this.emit('finish')
      this.emit('close')
    }
  })

  const p = new Pipeline(writable)
  p.write('a')
  p.write('b')
  p.write('c')
  p.end()
  return p.promise().then(() => t.same(buf.join(''), 'abc'))
})

t.test('pause/resume before adding a stream with data', t => {
  const p = new Pipeline()
  let sawData = false
  let sawEnd = false
  p.on('data', () => sawData = true)
  p.on('end', () => sawEnd = true)

  // does not throw
  p.resume()

  // explicitly pauses
  p.pause()

  const s = new Minipass()
  p.push(s)
  s.end('foo')

  t.equal(sawData, false, 'did not see data until resume')
  t.equal(sawEnd, false, 'did not see end until resume')
  p.resume()
  t.equal(sawData, true, 'saw data when resumed')
  t.equal(sawEnd, true, 'saw end when resumed')

  t.end()
})

t.test('pause/resume before adding an empty stream', t => {
  const p = new Pipeline()
  let sawData = false
  let sawEnd = false
  p.on('data', () => sawData = true)
  p.on('end', () => sawEnd = true)

  // does not throw
  p.resume()

  // explicitly pauses
  p.pause()

  const s = new Minipass()
  p.push(s)
  s.end()

  t.equal(sawData, false, 'did not see data until resume')
  t.equal(sawEnd, false, 'did not see end until resume')
  p.resume()
  t.equal(sawData, false, 'still no data (stream is empty!)')
  t.equal(sawEnd, true, 'saw end when resumed')
  t.end()
})

t.test('destroy destroys the whole pipeline', t => {
  const noDestroy = new Minipass()
  noDestroy.destroy = null
  const head = new Minipass()
  const tail = new Minipass()
  const p = new Pipeline(head, noDestroy, tail)
  p.destroy()
  t.equal(head.destroyed, true, 'head destroyed')
  t.equal(tail.destroyed, true, 'tail destroyed')
  t.equal(noDestroy.destroyed, false, 'not destroyed without destroy() method')
  t.equal(p.destroyed, true, 'pipeline destroyed')
  t.end()
})
