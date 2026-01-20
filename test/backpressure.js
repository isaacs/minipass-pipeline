const Pipeline = require('../')
const { Minipass } = require('minipass')
const t = require('tap')

t.test('verify that pipelines exert backpressure properly', t => {
  const tail = new class extends Minipass {
    write (chunk, encoding, cb) {
      const ret = super.write(chunk, encoding, cb)
      t.equal(ret, true, 'tail write should return true')
      return ret
    }
  }

  const head = new class extends Minipass {
    write (chunk, encoding, cb) {
      const ret = super.write(chunk, encoding, cb)
      t.equal(ret, true, 'head write should return true')
      return ret
    }
  }

  const pipe = new Pipeline({ encoding: 'utf8' }, head, tail)

  for (let i = 0; i < 5; i++) {
    t.equal(pipe.write('' + i), false, 'write is false until flowing')
  }

  const p = pipe.concat().then(d => t.equal(d, '0123456789', 'got expected data'))

  for (let i = 5; i < 10; i++) {
    t.equal(pipe.write('' + i), true, 'write is true when pipeline is flowing')
  }

  pipe.end()

  return p
})

t.test('tail that returns true, but does not fill up buffer', t => {
  const p = new Pipeline({ encoding: 'utf8' })
  const data = []
  const tail = new class Flushy extends Minipass {
    write (c) {
      data.push(c)
      return true
    }
    end () {
      super.write('flushed')
      return super.end()
    }
  }

  p.unshift(tail)

  const head = new Minipass()

  p.unshift(head)
  t.equal(p.write('ok'), true, 'write() should return true, nothing buffered')
  t.equal(p.write('ok'), true, 'write() should return true, nothing buffered')
  t.equal(p.write('ok'), true, 'write() should return true, nothing buffered')
  t.equal(p.write('ok'), true, 'write() should return true, nothing buffered')
  const res = Buffer.concat(data).toString('utf8')
  t.equal(res, 'okokokok', 'data passed through pipeline')
  t.equal(p.read(), null, 'no data to read until flushed at end')
  p.end()
  t.equal(p.read(), 'flushed', 'data comes through at last')
  t.end()
})
