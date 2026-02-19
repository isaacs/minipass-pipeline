const Pipeline = require('../')
const { Minipass } = require('minipass')

const t = require('tap')

t.test('backed up piped pipeline should auto-resume', t => {
  const p = new Pipeline(
    new Minipass(),
    new Minipass(),
    new Minipass(),
    new Minipass()
  )

  const dest = new Minipass({ encoding: 'utf8' })
  // pipe and then write some data so that the pipeline gets backed up
  p.pipe(dest)

  p.write('hello')
  p.write(' ')

  // now start consuming the destination
  const promise = dest.concat().then(buf => t.equal(buf, 'hello world'))

  t.equal(p.write('world'), true, 'pipeline should be unblocked')

  p.end()
  return promise
})
