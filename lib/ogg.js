var fs = require('fs');
var util = require('util');
var events = require('events');
var strtok = require('strtok2');
var common = require('./common');
var Dissolve = require('dissolve');
var sum = require('sum-component');
var Transform = require('stream').Transform;


module.exports = function (stream, callback, done, readDuration) {
  var commentsRead = 0;
  var sampleRate = 0;
  var pageNo = 0;

  var a = Dissolve({'objectMode':false})
    .loop(function (end) {
      // console.log(this)
      this
      .string('type', 4)
      .uint8('version')
      .uint8('packet_flag')
      .uint32le('agp_a')
      .uint32le('agp_b')
      .uint32le('stream_serial_num')
      .uint32le('page_number')
      .uint32le('checksum')
      .uint8('segments')
      .tap(function () {
        pageNo += 1
        var pageSamplePos = (this.vars.agp_a << 32) + this.vars.agp_b
        // console.log('psp: ' + pageSamplePos)
        // console.log('sampleRate: ' + sampleRate)
        // callback(Math.floor(pageSamplePos / sampleRate));
        // console.log(Math.floor(pageSamplePos / sampleRate))
        this.buffer('segments', this.vars.segments);
      })
      .tap(function () {
        this.buffer('page', sum(this.vars['segments']))
      })
      .tap(function () {
        console.log('pageNo: ' + pageNo)
        this.push(this.vars.page)
        // this.emit('data', this.vars.page)
        // console.log(this.push.toString())
      })
    })
  var b = Dissolve()
    .string('vorbis_header', 7)
    .tap(function () {
      console.log(this.vars)
      // run some assertion on '\x01vorbis'
    })
    .uint32le('version')
    .uint8('channel_mode')
    .uint32le('sample_rate')
    .buffer('ignore', 4)
    .uint32le('bitrate_nominal')
    .buffer('ignore', 6)
    .tap(function () {
      // console.log(this.vars)
      sampleRate = this.vars.sample_rate;
    })
    .string('vorbis_header', 7)
    .tap(function () {
      console.log(this.vars)
      // run some assertion on '\x03vorbis'
    })
    .uint32le('vlen')
    .string('vstr', 'vlen')
    .uint32le('comments_length')
    .loop(function (end) {
      this
      .uint32le('comment_length')
      .string('comment', 'comment_length')
      .tap(function () {
        commentsRead++;

        // console.log(this.vars)

        var v = this.vars.comment;
        var idx = v.indexOf('=');
        var key = v.slice(0, idx).toUpperCase();
        var value = v.slice(idx+1);

        if (key === 'METADATA_BLOCK_PICTURE') {
          value = common.readVorbisPicture(new Buffer(value, 'base64'));
        }

        var obj = {}
        obj[key] = value
        console.log('here!')
        this.push(obj)

        if (commentsRead === this.vars.comments_length) {
          done()
          end()
        }
      })
    })

  a.on('readable', function () {
    console.log('in readable')

    var chunk
    while (null !== (chunk = a.read(1000))) {
      console.log(chunk)
    }
  })
  stream.pipe(a)


  // b.on('readable', function () {
  //   console.log('in readable')
  //   // console.log(a.read())
  //   // console.log('in readable')
  //   // var x = b.read()
  //   // var lst = []
  //   // lst.push(Object.keys(x)[0])
  //   // lst.push(x[Object.keys(x)[0]])
    
  //   // // object.keys()
  //   // callback.apply(this, lst)
  //   // console.log(lst)
  // })

  // stream.pipe(a).pipe(b)
}
