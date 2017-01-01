var _ = require('lodash');
var Crafty = require('craftyjs');

const MAGIC = false;

const SCREEN_WIDTH = 1000;
const SCREEN_HEIGHT = 600;

const ATTRACTOR_WIDTH = 10;
const BOID_WIDTH = 4;
const NUM_BOIDS = MAGIC ? 10 : 200;

const Vector = Crafty.math.Vector2D;

class Boids {

  constructor() {
    this.boids = [];
    this.attractors = [];

    this.maxSpeed = 350;
    this.wallDistance = 60;
    this.centerOfMassDistance = 265;
    this.centerOfMassPercent = 17;
    this.distanceUnit = 23;
    this.distancePercent = 80;
    this.matchVelocityDistance = 42;
    this.matchVelocityPercent = 68;
    this.attractorDistance = 200;
    this.attractorPercent = 98;
    this.jitter = 4;

    this.init();

  }

  init() {
    Crafty.init(SCREEN_WIDTH, SCREEN_HEIGHT);
    Crafty.background('black');
    const that = this;

    // canvas
    Crafty.e('2D, Canvas, Color, Mouse')
      .attr({x: 0, y: 0, w: SCREEN_WIDTH, h: SCREEN_HEIGHT})
      .color('black')
      .bind('Click', function(MouseEvent){
        that._createAttractor(MouseEvent.offsetX, MouseEvent.offsetY);
      });

    // boids
    _.times(NUM_BOIDS, () => {
      const x = _.random(0, SCREEN_WIDTH - BOID_WIDTH);
      const y = _.random(0, SCREEN_HEIGHT - BOID_WIDTH);
      const vx = _.random(-100, 100);
      const vy = _.random(-100, 100);
      const width = _.random(3, 4, true);
      const boid = Crafty.e('2D, Canvas, Color, Motion').attr({
        x: x,
        y: y,
        w: width,
        h: width,
        velocity: new Vector(vx, vy),
        position: new Vector(x, y),
        particle: MAGIC ? this._createParticle(x, y) : {},
      })
      .color(_.sample(['#FFF', '#F0F0F0', '#D0D0D0']))
      .bind("EnterFrame", function(eventData) {
        that.frame(eventData, this);
      });

      this.boids.push(boid);
    });
  }

  frame(eventData, boid) {
    const modifiers = [];
    modifiers.push(this._ruleCenterOfMass(boid));
    modifiers.push(this._ruleDistance(boid));
    modifiers.push(this._ruleMatchVelocity(boid));
    modifiers.push(this._ruleStayAwayFromTheWalls(boid));
    modifiers.push(this._ruleAttractors(boid));
    modifiers.push(this._addJitter(boid));

    _.each(modifiers, (modifier) => boid.velocity.add(modifier));

    // Speed limit
    let vx = boid.velocity.x;
    let vy = boid.velocity.y;
    vx = _.clamp(vx, -this.maxSpeed, this.maxSpeed);
    vy = _.clamp(vy, -this.maxSpeed, this.maxSpeed);
    boid.velocity.setValues(vx, vy);

    const fudge = eventData.dt / 1000;
    const fudgeVector = new Vector(fudge, fudge);
    const newVelocity = boid.velocity.clone().multiply(fudgeVector);

    boid.position.add(newVelocity);

    boid.x = boid.position.x;
    boid.y = boid.position.y;

    boid.particle.x = boid.x;
    boid.particle.y = boid.y;
  }

  _createParticle(x, y) {
    return Crafty.e("2D, Canvas, Particles").attr({ x: x, y: y }).particles({
      maxParticles: 5,
      size: 1,
      sizeRandom: 2,
      speed: 1,
      speedRandom: 1.2,
      // Lifespan in frames
      lifeSpan: 29,
      lifeSpanRandom: 7,
      // Angle is calculated clockwise: 12pm is 0deg, 3pm is 90deg etc.
      angle: 0,
      angleRandom: 0,
      startColour: [255, 255, 255, 255],
      startColourRandom: [255, 255, 255, 255],
      endColour: [255, 255, 255, 255],
      endColourRandom: [255, 255, 255, 255],
      // Only applies when fastMode is off, specifies how sharp the gradients are drawn
      sharpness: 20,
      sharpnessRandom: 10,
      // Random spread from origin
      spread: 10,
      // How many frames should this last
      duration: -1,
      // Will draw squares instead of circle gradients
      fastMode: true,
      gravity: { x: 0, y: 0 },
      // sensible values are 0-3
      jitter: 1,
      // Offset for the origin of the particles
      originOffset: {x: 0, y: 0}
    });
  }

  _createAttractor(x, y) {
    const that = this;
    const attractor = Crafty.e('2D, Canvas, Color, Mouse')
      .attr({
        position: new Vector(x, y),
        x: x,
        y: y,
        w: ATTRACTOR_WIDTH,
        h: ATTRACTOR_WIDTH,
      })
      .color('green')
      .bind('Click', function(MouseEvent) {
        _.remove(that.attractors, this)
        this.destroy();
      });

    this.attractors.push(attractor);
  }

  _addJitter(boid) {
    return new Vector(
      _.random(-this.jitter, this.jitter),
      _.random(-this.jitter, this.jitter)
    );
  }

  _ruleCenterOfMass(boid) {
    const velocity = new Vector();
    let num = 0;
    _.each(this.boids, b => {
      if (boid === b) return;
      if (Math.abs(boid.position.distance(b.position)) < this.centerOfMassDistance) {
        velocity.add(b.position);
        num++;
      }
    });
    if (num === 0) return new Vector();
    velocity.divide(new Vector(num, num));
    return velocity.subtract(boid.position)
      .divide(new Vector(100 - this.centerOfMassPercent, 100 - this.centerOfMassPercent));
  }

  _ruleDistance(boid) {
    const velocity = new Vector();
    _.each(this.boids, b => {
      if (boid === b) return;
      if (Math.abs(boid.position.distance(b.position)) < this.distanceUnit) {
        velocity.subtract(b.position.clone().subtract(boid.position))
      }
    })

    return velocity.scale(this.distancePercent / 100);
  }

  _ruleMatchVelocity(boid) {
    const velocity = new Vector();
    let num = 0;
    _.each(this.boids, b => {
      if (boid === b) return;
      if (Math.abs(boid.position.distance(b.position)) < this.matchVelocityDistance) {
        num++;
        velocity.add(b.velocity);
      }
    });

    if (num === 0) return new Vector();

    return velocity.divide(new Vector(num, num))
      .subtract(boid.velocity)
      .divide(new Vector(101 - this.matchVelocityPercent, 101 - this.matchVelocityPercent));
  }

  _ruleStayAwayFromTheWalls(boid) {
    let newX = 0;
    let newY = 0;

    if (boid.position.x > (SCREEN_WIDTH - this.wallDistance)) {
      newX = (SCREEN_WIDTH - this.wallDistance) - boid.position.x;
    }

    if (boid.position.x < this.wallDistance) {
      newX = this.wallDistance - boid.position.x;
    }

    if (boid.position.y < this.wallDistance) {
      newY = this.wallDistance - boid.position.y;
    }

    if (boid.position.y > (SCREEN_HEIGHT - this.wallDistance)) {
      newY = (SCREEN_HEIGHT - this.wallDistance) - boid.position.y;
    }

    return new Vector(newX, newY);
  }

  _ruleAttractors(boid) {
    if (this.attractors.length === 0) return new Vector();
    let closestAttractor, closestDistance;
    _.each(this.attractors, function(attractor) {
      const distance = Math.abs(boid.position.distance(attractor.position));
      if ((!closestDistance || distance < closestDistance) && distance < this.attractorDistance) {
        closestDistance = distance;
        closestAttractor = attractor;
      }
    }.bind(this));
    if (closestAttractor) {
      return closestAttractor.position.clone()
        .subtract(boid.position)
        .divide(new Vector(100 - this.attractorPercent, 100 - this.attractorPercent));
    }
    return new Vector();
  //   const velocity = new Vector();
  //   if (this.attractors.length === 0) return velocity;
  //   let numAttractors = 0;
  //   _.each(this.attractors, a => {
  //     if (Math.abs(boid.position.distance(a.position)) < this.attractorDistance) {
  //       numAttractors++;
  //       velocity.add(a.position);
  //     }
  //   });
  //   if (numAttractors === 0) return velocity;
  //   // velocity.divide(new Vector(numAttractors, numAttractors));
  //   return velocity
  //     .subtract(boid.position)
  //     .divide(new Vector(100 - this.attractorPercent, 100 - this.attractorPercent));
  }

}

const boids = new Boids();
const gui = new dat.GUI();

gui.add(boids, 'maxSpeed', 0, 1000);
gui.add(boids, 'wallDistance', 0, 362);
gui.add(boids, 'centerOfMassDistance', 0, 500);
gui.add(boids, 'centerOfMassPercent', 0, 100);
gui.add(boids, 'distanceUnit', 0, 200);
gui.add(boids, 'distancePercent', 0, 100);
gui.add(boids, 'matchVelocityDistance', 0, 500);
gui.add(boids, 'matchVelocityPercent', 0, 100);
gui.add(boids, 'attractorDistance', 0, 500);
gui.add(boids, 'attractorPercent', 0, 100);
gui.add(boids, 'jitter', 0, 100);
