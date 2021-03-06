const SCREEN_WIDTH = 900;
const SCREEN_HEIGHT = 570;

const ATTRACTOR_WIDTH = 10;
const DETRACTOR_WIDTH = 10;
const BOID_WIDTH = 4;
const NUM_BOIDS = 200;

const Vector = Crafty.math.Vector2D;
const ZERO_VECTOR = new Vector();

class Boids {

  constructor() {
    this.boids = [];
    this.attractors = [];
    this.detractors = [];

    this.centerOfMassDistance = 265;
    this.centerOfMassPercent = 17;

    this.distanceUnit = 23;
    this.distancePercent = 49;

    this.matchVelocityDistance = 42;
    this.matchVelocityPercent = 68;

    this.attractorDistance = 200;
    this.attractorPercent = 93;

    this.detractorDistance = 200;
    this.detractorPercent = 93;

    this.maxSpeed = 200;
    this.jitter = 4;
    this.wallDistance = 0;

    this.windDirection = 0;
    this.windPower = 0;

    this.wrapAround = false;

    this.init();
  }

  init() {
    Crafty.init(SCREEN_WIDTH, SCREEN_HEIGHT);
    Crafty.background('black');

    // canvas
    Crafty.e('2D, Canvas, Color, Mouse')
      .attr({x: 0, y: 0, w: SCREEN_WIDTH, h: SCREEN_HEIGHT})
      .color('black')
      .bind('MouseUp', event => {
        if (event.mouseButton ===  Crafty.mouseButtons.LEFT) {
          this._createAttractor(event.offsetX, event.offsetY);
        } else if (event.mouseButton ===  Crafty.mouseButtons.RIGHT) {
          this._createDetractor(event.offsetX, event.offsetY);
        }
      })

    const that = this;
    // boids
    _.times(NUM_BOIDS, () => {
      const x = _.random(0, SCREEN_WIDTH - BOID_WIDTH);
      const y = _.random(0, SCREEN_HEIGHT - BOID_WIDTH);
      const vx = _.random(-100, 100);
      const vy = _.random(-100, 100);
      const width = _.random(2, 4, true);
      const boid = Crafty.e('2D, Canvas, Color, Motion').attr({
        x: x,
        y: y,
        w: width,
        h: width,
        velocity: new Vector(vx, vy),
        position: new Vector(x, y),
      })
      .color('white')
      .bind('EnterFrame', function(eventData) {
        that.frame(eventData, this);
      });

      this.boids.push(boid);
    });
  }

  frame(eventData, boid) {
    const modifiers = [];
    modifiers.push(this._calcCenterOfMass(boid));
    modifiers.push(this._calcDistance(boid));
    modifiers.push(this._calcMatchVelocity(boid));
    if (!this.wrapAround) {
      modifiers.push(this._calcStayAwayFromTheWalls(boid));
    }
    modifiers.push(this._calcAttractors(boid));
    modifiers.push(this._calcDetractors(boid));
    modifiers.push(this._addJitter(boid));
    modifiers.push(this._calcWind());

    _.each(modifiers, m => boid.velocity.add(m));

    this._speedLimit(boid);

    // Update baed on FPS
    const fudge = eventData.dt / 1000;
    const fudgeVector = new Vector(fudge, fudge);
    const newVelocity = boid.velocity.clone().multiply(fudgeVector);

    // Update position based on new velocity.
    boid.position.add(newVelocity);
    boid.x = boid.position.x;
    boid.y = boid.position.y;

    this._wrapAround(boid);
  }

  explode() {
    _.each(this.boids, b => {
      b.velocity.setValues(
        _.sample([-this.maxSpeed, this.maxSpeed]),
        _.sample([-this.maxSpeed, this.maxSpeed])
      );
    });
  }

  _speedLimit(boid) {
    const vx = _.clamp(boid.velocity.x, -this.maxSpeed, this.maxSpeed);
    const vy = _.clamp(boid.velocity.y, -this.maxSpeed, this.maxSpeed);
    boid.velocity.setValues(vx, vy);
  }

  _wrapAround(boid) {
    if (!this.wrapAround) return;

    if (boid.x > SCREEN_WIDTH) {
      boid.x = 0;
      boid.position.setValues(0, boid.position.y);
    }
    if (boid.x < 0) {
      boid.x = SCREEN_WIDTH
      boid.position.setValues(SCREEN_WIDTH, boid.position.y);
    }

    if (boid.y > SCREEN_HEIGHT) {
      boid.y = 0;
      boid.position.setValues(boid.position.x, 0);
    }
    if (boid.y < 0) {
      boid.y = SCREEN_HEIGHT;
      boid.position.setValues(boid.position.x, SCREEN_HEIGHT);
    }
  }

  _createDetractor(x, y) {
    const that = this;
    const attractor = Crafty.e('2D, Canvas, Color, Mouse')
      .attr({
        position: new Vector(x, y),
        x: x,
        y: y,
        w: DETRACTOR_WIDTH,
        h: DETRACTOR_WIDTH,
      })
      .color('red')
      .bind('MouseUp', function(MouseEvent) {
        if (event.mouseButton ===  Crafty.mouseButtons.LEFT) {
          _.remove(that.detractors, this)
          this.destroy();
        }
      });

    this.detractors.push(attractor);
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
      .bind('MouseUp', function(MouseEvent) {
        if (event.mouseButton ===  Crafty.mouseButtons.LEFT) {
          _.remove(that.attractors, this)
          this.destroy();
        }
      });

    this.attractors.push(attractor);
  }

  _addJitter(boid) {
    return new Vector(
      _.random(-this.jitter, this.jitter),
      _.random(-this.jitter, this.jitter)
    );
  }

  _calcCenterOfMass(boid) {
    const velocity = new Vector();
    let num = 0;
    _.each(this.boids, b => {
      if (boid === b) return;
      if (Math.abs(boid.position.distance(b.position)) < this.centerOfMassDistance) {
        velocity.add(b.position);
        num++;
      }
    });
    if (num === 0) return ZERO_VECTOR;
    velocity.divide(new Vector(num, num));
    return velocity.subtract(boid.position)
      .divide(new Vector(101 - this.centerOfMassPercent, 101 - this.centerOfMassPercent));
  }

  _calcDistance(boid) {
    const velocity = new Vector();
    _.each(this.boids, b => {
      if (boid === b) return;
      if (Math.abs(boid.position.distance(b.position)) < this.distanceUnit) {
        velocity.subtract(b.position.clone().subtract(boid.position))
      }
    })

    return velocity.scale(this.distancePercent / 100);
  }

  _calcMatchVelocity(boid) {
    const velocity = new Vector();
    let num = 0;
    _.each(this.boids, b => {
      if (boid === b) return;
      if (Math.abs(boid.position.distance(b.position)) < this.matchVelocityDistance) {
        num++;
        velocity.add(b.velocity);
      }
    });

    if (num === 0) return ZERO_VECTOR;

    return velocity.divide(new Vector(num, num))
      .subtract(boid.velocity)
      .divide(new Vector(101 - this.matchVelocityPercent, 101 - this.matchVelocityPercent));
  }

  _calcStayAwayFromTheWalls(boid) {
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

  _calcDetractors(boid) {
    const velocity = new Vector();
    if (this.detractors.length === 0) return velocity;
    let num = 0;
    _.each(this.detractors, detractor => {
      const distance = Math.abs(boid.position.distance(detractor.position));
      if (distance > this.detractorDistance) return;
      const magnitude = distance - this.detractorDistance;
      const angle = Math.PI - boid.position.angleTo(detractor.position);
      const x = Math.cos(angle) * magnitude;
      const y = Math.sin(angle) * magnitude;
      velocity.add(new Vector(x, y));
    });
    return velocity.divide(new Vector(101 - this.detractorPercent, 101 - this.detractorPercent));;
  }

  _calcAttractors(boid) {
    if (this.attractors.length === 0) return ZERO_VECTOR;
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
        .divide(new Vector(101 - this.attractorPercent, 101 - this.attractorPercent));
    }
    return ZERO_VECTOR;
  }

  _calcWind() {
    if (this.windPower === 0) return ZERO_VECTOR;
    const angle = this.windDirection * Math.PI / 180
    const x = Math.cos(angle) * this.windPower;
    const y = Math.sin(angle) * this.windPower;
    return new Vector(x, y)
  }

}

window.onload = function() {
  const boids = new Boids();
  const gui = new dat.GUI();

  const centerOfMass = gui.addFolder('Cohesion');
  centerOfMass.add(boids, 'centerOfMassDistance', 0, 500).name('Distance');
  centerOfMass.add(boids, 'centerOfMassPercent', 0, 100).name('Percent');
  centerOfMass.open();

  const maintainDistance = gui.addFolder('Separation');
  maintainDistance.add(boids, 'distanceUnit', 0, 200).name('Distance');
  maintainDistance.add(boids, 'distancePercent', 0, 100).name('Percent');
  maintainDistance.open();

  const matchVelocity = gui.addFolder('Alignment');
  matchVelocity.add(boids, 'matchVelocityDistance', 0, 500).name('Distance');
  matchVelocity.add(boids, 'matchVelocityPercent', 0, 100).name('Percent');
  matchVelocity.open();

  const attractor = gui.addFolder('Attractors');
  attractor.add(boids, 'attractorDistance', 0, 500).name('Distance');
  attractor.add(boids, 'attractorPercent', 0, 100).name('Percent');

  const detractor = gui.addFolder('Detractors');
  detractor.add(boids, 'detractorDistance', 0, 500).name('Distance');
  detractor.add(boids, 'detractorPercent', 0, 100).name('Percent');

  const wind = gui.addFolder('Wind');
  wind.add(boids, 'windDirection', 0, 360).name('Direction');
  wind.add(boids, 'windPower', 0, 15).name('Power');

  const misc = gui.addFolder('Misc');
  misc.add(boids, 'maxSpeed', 0, 1000).name('Max Speed');
  misc.add(boids, 'wallDistance', 0, 362).name('Wall Distance');
  misc.add(boids, 'jitter', 0, 100).name('Jitter');
  misc.add(boids, 'wrapAround').name('Wrap Around');
  misc.add(boids, 'explode').name('Explode');
}
