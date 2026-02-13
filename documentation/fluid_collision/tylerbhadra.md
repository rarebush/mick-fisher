CS 184: Computer Graphics and Imaging, Spring 2023
2D Fluid Collision Simulator
Tyler Bhadra, Charlie Chen, Maxwell Lo, Victor Zhang

Abstract
In this project, we implemented a 2D fluid simulation using Threejs and WebGL. Our simulator is based on the Navier Stokes equations and utilizes a 2D grid of attributes that determine the movement of particles within the grid. Using WebGL, we perform the relevant calculations using a set of fragment shaders that encode the various attributes and manipulate their values. We also implemented interactivity allowing the user to create new forces to affect the fluid flow, construct barriers to block flow, and switch between different visualizations of the particles and attribute fields. The resulting simulation is capable of running on most modern browsers and can be seen here.

Technical Approach
Preface
Our approach was based on the implementation described in Nvidia Developer Chapter 38, which we used as a reference for implementing the Navier-Stokes calculations. We also created a particle simulation on top of the 2D attribute grid to better display the movement of the fluid, as well as internal boundary conditions to allow for user drawn barriers.

Navier Stokes Equations
Our fluid simulation is based on the Navier Stokes equations and assume an incompressible homogenous fluid. The Navier Stokes equations (for an incompressible fluid) are as follows:

 <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mfrac>
    <mrow>
      <mi mathvariant="normal">&#x2202;</mi>
      <mi>u</mi>
    </mrow>
    <mrow>
      <mi mathvariant="normal">&#x2202;</mi>
      <mi>t</mi>
    </mrow>
  </mfrac>
  <mo>=</mo>
  <mo>&#x2212;</mo>
  <mo stretchy="false">(</mo>
  <mi>u</mi>
  <mo>&#x22C5;</mo>
  <mi mathvariant="normal">&#x2207;</mi>
  <mo stretchy="false">)</mo>
  <mi>u</mi>
  <mo>&#x2212;</mo>
  <mfrac>
    <mn>1</mn>
    <mi>&#x3C1;</mi>
  </mfrac>
  <mi mathvariant="normal">&#x2207;</mi>
  <mi>p</mi>
  <mo>+</mo>
  <mi>v</mi>
  <msup>
    <mi mathvariant="normal">&#x2207;</mi>
    <mn>2</mn>
  </msup>
  <mi>u</mi>
  <mo>+</mo>
  <mi>F</mi>
</math>

Where u represents the flow velocity, p represents pressure, v represents viscosity, and F is the effect of external forces, which in our simulation, is the user mouse click. Looking at each term, we have Variation = Advection - Pressure + Diffusion + External Forces.
To calculate the effects of the Navier Stokes equations, we took each term and had a different shader perform the calculations by storing the results to a texture map. Thus, we had a shader for advection, one for pressure, one for diffusion, as well as a few shaders for intermediate calculations such as jacobi iteration.

Project Framework
Our simulator is built in Javascript using Three.js, which allows us to utilize WebGL to perform calculations and draw 3D (but we only use 2D) graphics to the screen. For each of the attributes that are able to be visualized (velocity, divergence, and pressure), we have an AttributeField class which contains WebGLRenderTarget buffers that we have the shaders read and write to in order to update the parameters. Because we cannot read and write to the same buffer at once, we have a specific read and write buffer and switch them after each update. Within our main simulation loop, we repeatedly pass these AttributeField buffer textures' buffers to the respective calculation shaders and have them perform one of the calculations required to complete one timestep update, then draw the results to the screen.

We also implemented shaders to handle the movement of randomly placed particles, which are advected (at least visually) through the fluid by forward integration using the velocity vector field (We use a basic euler step to achieve this). Finally, we implemented user interactivity by tracking the position of the mouse and whether it is pressed or not, and adding external forces or boundary cells to the area that the mouse drags over.

The settings menu was created with dat.gui as a lightweight and low complexity user interface that allowed us to focus more development on the actual simulator.

Shaders

General implementation of a shader program (Advection shown).

Workflow of shader programs for each timestep.

Advection
Advection is the process of a fluid transporting itself. For our 2D grid of attributes, we represent this as updating a grid cell to a new velocity given its previous velocity. This is calculated using an implicit method (Stam 1999) that is stable for arbitrary timesteps and velocities.

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi>q</mi>
  <mo stretchy="false">(</mo>
  <mi>x</mi>
  <mo>,</mo>
  <mi>t</mi>
  <mo>+</mo>
  <mi>&#x3B4;</mi>
  <mi>t</mi>
  <mo stretchy="false">)</mo>
  <mo>=</mo>
  <mi>q</mi>
  <mo stretchy="false">(</mo>
  <mi>x</mi>
  <mo>&#x2212;</mo>
  <mi>u</mi>
  <mo stretchy="false">(</mo>
  <mi>x</mi>
  <mo>,</mo>
  <mi>t</mi>
  <mo stretchy="false">)</mo>
  <mi>&#x3B4;</mi>
  <mi>t</mi>
  <mo>,</mo>
  <mi>t</mi>
  <mo stretchy="false">)</mo>
</math>

where q is the updated fluid property (velocity in our case), u(x, t) is the original value of the fluid property, x is the cell position, and t is the timestep (which we fix to 1.0 for our implementation).

Divergence
Divergence measures the change in velocity across a surface surrounding a small area of fluid. We then update the velocity field according to the following formula:

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi mathvariant="normal">&#x2207;</mi>
  <mo>&#x22C5;</mo>
  <mi>u</mi>
  <mo>=</mo>
  <mfrac>
    <mrow>
      <mi>&#x3B4;</mi>
      <mi>u</mi>
    </mrow>
    <mrow>
      <mi>&#x3B4;</mi>
      <mi>x</mi>
    </mrow>
  </mfrac>
  <mo>+</mo>
  <mfrac>
    <mrow>
      <mi>&#x3B4;</mi>
      <mi>v</mi>
    </mrow>
    <mrow>
      <mi>&#x3B4;</mi>
      <mi>y</mi>
    </mrow>
  </mfrac>
  <mo>=</mo>
  <mfrac>
    <mrow>
      <msub>
        <mi>u</mi>
        <mrow>
          <mi>i</mi>
          <mo>+</mo>
          <mn>1</mn>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
      <mo>&#x2212;</mo>
      <msub>
        <mi>u</mi>
        <mrow>
          <mi>i</mi>
          <mo>&#x2212;</mo>
          <mn>1</mn>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
    </mrow>
    <mrow>
      <mn>2</mn>
      <mi>&#x3B4;</mi>
      <mi>x</mi>
    </mrow>
  </mfrac>
  <mo>+</mo>
  <mfrac>
    <mrow>
      <msub>
        <mi>v</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
          <mo>+</mo>
          <mn>1</mn>
        </mrow>
      </msub>
      <mo>&#x2212;</mo>
      <msub>
        <mi>v</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
          <mo>&#x2212;</mo>
          <mn>1</mn>
        </mrow>
      </msub>
    </mrow>
    <mrow>
      <mn>2</mn>
      <mi>&#x3B4;</mi>
      <mi>y</mi>
    </mrow>
  </mfrac>
</math>

where u and v are parameters of the velocity field u = (u, v).

Jacobi Iteration
Jacobi iteration is an iterative technique that converges towards a solution for a system of linear equations. We use it here to solve poisson equations, which include the pressure field and the viscosity term.

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <msubsup>
    <mi>x</mi>
    <mrow>
      <mi>i</mi>
      <mo>,</mo>
      <mi>j</mi>
    </mrow>
    <mrow>
      <mi>k</mi>
      <mo>+</mo>
      <mn>1</mn>
    </mrow>
  </msubsup>
  <mo>=</mo>
  <mfrac>
    <mrow>
      <msubsup>
        <mi>x</mi>
        <mrow>
          <mi>i</mi>
          <mo>&#x2212;</mo>
          <mn>1</mn>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
        <mi>k</mi>
      </msubsup>
      <mo>+</mo>
      <msubsup>
        <mi>x</mi>
        <mrow>
          <mi>i</mi>
          <mo>+</mo>
          <mn>1</mn>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
        <mi>k</mi>
      </msubsup>
      <mo>+</mo>
      <msubsup>
        <mi>x</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
          <mo>&#x2212;</mo>
          <mn>1</mn>
        </mrow>
        <mi>k</mi>
      </msubsup>
      <mo>+</mo>
      <msubsup>
        <mi>x</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
          <mo>+</mo>
          <mn>1</mn>
        </mrow>
        <mi>k</mi>
      </msubsup>
      <mo>+</mo>
      <mi>&#x3B1;</mi>
      <msub>
        <mi>b</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
    </mrow>
    <mi>&#x3B2;</mi>
  </mfrac>
</math>

where x is the field (pressure or velocity), b is the divergence, alpha and beta are constants.

Gradient Subtraction
To ensure that we have an incompressible fluid (which means divergence is 0 by Navier Stokes), we subtract the pressure gradient from the velocity field.

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi>u</mi>
  <mo>=</mo>
  <mi>w</mi>
  <mo>&#x2212;</mo>
  <mi mathvariant="normal">&#x2207;</mi>
  <mi>p</mi>
</math>

Combining divergence, the poisson pressure distribution, and gradient subtraction gives us the pressure term in the Navier Stokes equation, which describes projection of the fluid from high pressure to low pressure areas.

External Forces
When the user clicks their mouse and drags, we generate a force that is added to the velocity field in the direction of the drag. This follows the following formula:

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi>c</mi>
  <mo>=</mo>
  <mi>F</mi>
  <mi>&#x3B4;</mi>
  <mi>t</mi>
  <mfrac>
    <mrow>
      <mo stretchy="false">(</mo>
      <mi>x</mi>
      <mo>&#x2212;</mo>
      <msub>
        <mi>x</mi>
        <mi>p</mi>
      </msub>
      <msup>
        <mo stretchy="false">)</mo>
        <mn>2</mn>
      </msup>
      <mo>+</mo>
      <mo stretchy="false">(</mo>
      <mi>y</mi>
      <mo>&#x2212;</mo>
      <msub>
        <mi>y</mi>
        <mi>p</mi>
      </msub>
      <msup>
        <mo stretchy="false">)</mo>
        <mn>2</mn>
      </msup>
    </mrow>
    <mi>r</mi>
  </mfrac>
</math>

where c is the representation of force to add to the velocity field, F is the force computed from the mouse drag, and (x, y) and (xp, yp) are the cell position and click position. We see that the large fraction is simply distance over radius, so that the cells closest to the mouse have the greatest increase.

Boundaries
In order to implement boundaries, we needed to enforce no-slip velocity boundary conditions and pure Neumann pressure boundary conditions after modifying the velocityField and pressureField. Within the other shader programs it is assumed that every grid cell lies within the fluid domain. The boundary shader programs adjust the velocities and pressure values acquired through the simulation process to take into account the existence of grid cells that lie in the boundary domain.

No-slip velocity boundary conditions are applied differently depending on the type of boundary cell we are dealing with. The first type is a boundary cell that borders only one fluid cell.

For example, in the case of a boundary cell B_W located at cell (i,j) with a fluid cell to its left in cell (i-1,j), we set the velocity of the boundary cell to the negated velocity of its fluid cell neighbor, following this constraint equation:

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mfrac>
    <mrow>
      <msub>
        <mi>u</mi>
        <mrow>
          <mi>i</mi>
          <mo>&#x2212;</mo>
          <mn>1</mn>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
      <mo>&#x2212;</mo>
      <msub>
        <mi>u</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
    </mrow>
    <mn>2</mn>
  </mfrac>
</math>

To enforce pure Neumann pressure boundary conditions, we set the pressure value of a boundary cell to the pressure value of its fluid cell neighbor, following this constraint equation:

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mfrac>
    <mrow>
      <msub>
        <mi>p</mi>
        <mrow>
          <mi>i</mi>
          <mo>&#x2212;</mo>
          <mn>1</mn>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
      <mo>&#x2212;</mo>
      <msub>
        <mi>p</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
    </mrow>
    <mrow>
      <mi>&#x3B4;</mi>
      <mi>x</mi>
    </mrow>
  </mfrac>
</math>

In the case where a boundary cell borders multiple fluid cells, we simply set the boundary velocity to the negated average of all its neighboring fluid cell velocities. For a boundary cell B_NE with neigboring fluid cells in its north and east directions, the boundary velocity ui,j is computed as such:

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <msub>
    <mi>u</mi>
    <mrow>
      <mi>i</mi>
      <mo>,</mo>
      <mi>j</mi>
    </mrow>
  </msub>
  <mo>=</mo>
  <mo>&#x2212;</mo>
  <mfrac>
    <mrow>
      <msub>
        <mi>u</mi>
        <mrow>
          <mi>i</mi>
          <mo>,</mo>
          <mi>j</mi>
          <mo>+</mo>
          <mn>1</mn>
        </mrow>
      </msub>
      <mo>+</mo>
      <msub>
        <mi>u</mi>
        <mrow>
          <mi>i</mi>
          <mo>+</mo>
          <mn>1</mn>
          <mo>,</mo>
          <mi>j</mi>
        </mrow>
      </msub>
    </mrow>
    <mn>2</mn>
  </mfrac>
</math>

Pressure values are calculated in the same way, except the average value is not negated.

Fluid interaction with downstream obstacles.

Particles
There are three main shaders used for simulating and rendering particles with the trail effect. The particle simulation shader is purely for simulating the movement of the particles. It takes in a texture buffer of particle positions, as well as the velocityField, and calculates new positions using forward integration, storing them in a new WebGLRenderTarget. Essentially we are moving the particles according to where they sit on top of the velocity vector field. (NOTE: The resolution of the particle positions texture is particle_span x particle_span, where particle_span equals the square root of the number of particles)

The particle aging shader keeps track of and increments each particles age in a particle age texture and is the same resolution as the particle positions texture. This ensures that any texture coordinate ( u, v ) corresponds to only one position and one age (i.e a specific texture coordinate ( u, v ) is associated with one specific particle and its relevant information). When a particle reaches its max lifespan (We used 100 timesteps) it is returned to its initial position. This keeps the particles from moving offscreen.

The particle rendering shader takes in the particle positions and renders them to a canvas texture which is used later during the final render to the screen. To achieve the trailing effect, a semi transparent plane is rendered on top of the particles at every timestep (We use an opacity of 0.01).

Problems Encountered
Initially, we had some trouble with getting the framework set up to be able to render the particle simulation, as none of us had prior experience working with three.js or WebGL. Additionally, until we implemented most of the features (advection, pressure, diffusion, external forces), it was difficult to debug our output besides checking that the screen rendered what we expected it to, as the error messages for gpu shaders were very nondescriptive.
We encountered a problem after implementing particles and some of the basic computational steps for a very basic fluid simulation where we could interact with our cursor to move the fluid around, but the movement and velocity would not propagate through regions of the fluid that had not been interacted with yet. To address this, we added the ability to change the display to the different results of the shaders and compared the results to the results of another known working fluid simulator. It was through this that we found out that the pressure layer was not being calculated properly since interacting with the cursor would not make any change to the layer at all. After pouring over the code, we eventually stumbled upon the source of the problems: we had capitalized a variable incorrectly, causing it to reference some garbage value. After correcting this variable name, the simulator started propagating velocity through the fluid, allowing any disturbances from the user to spread out across the screen.

Lessons
Some lessons learned include how to use the GPU to perform lots of calculations in parallel provided that you manipulate the data in a manner that the GPU can handle. In our case, this was through the use of shaders. We also learned how to use WebGL from using Three.js to manipulate said shaders, and gained insight as to how the Navier-Stokes equations work and the various terms used to describe the velocity of the fluid.

Results
In the final simulation, the user can generate forces to affect the velocity of the fluid, and construct barriers to impede the flow in real time. The user can also utilize the settings menu to visualize different aspects of the fluid.

To generate a force, construct a barrier, or erase a barrier, switch the "input mode" dropdown to the respective mode and click and drag on the screen. To reset the fluid velocity or clear all boundaries drawn, check and uncheck the respective boxes.

You can run the simulation here.

Contributions
Tyler Bhadra:

Built the project framework for loading and running shaders for GPU simulation and set up the rendering environment used for the visualization of fluid behavior (With three.js and WebGL). Implemented the particle system shaders (For particle aging, simulation, and trail rendering). Implemented fluid interaction with arbitrarily placed boundaries. Also implemented boundary interactability (draw/erase functionality) and co-wrote the milestone report and final report with Maxwell and Victor.

Charlie Chen:

Implemented the Jacobi, Gradient, and Divergence shader programs used in the viscous diffusion step and projection step. Worked on the visualization of grid attributes (Pressure, divergence, velocity) with Maxwell. Helped with fluid-boundary interactions. Also, added GUI elements and worked on the final presentation slides.

Maxwell Lo:

Wrote the Advection shader program and the External Forces shader program. Also implemented the interactive “Drag Fluid” functionality. Worked on the visualization of grid attributes (Pressure, divergence, velocity) with Charlie. Put together the milestone presentation slides and co-wrote the milestone report and final report with Tyler and Victor.

Victor Zhang:

Worked on the final presentation slides. Filmed both the milestone progress report video and the final demo video. Helped debug the Jacobi, Gradient, and Divergence shader programs. Also fleshed out the GUI display options to allow for user selection of visualization layers (i.e. fluid, velocity, pressure, and divergence) and added buttons for resetting fluid and boundary states. Co-wrote the final report with Maxwell and Tyler.

References
LilyPad

Fluid Dynamics Simulation, Dan Schroeder

WebGL Fluid Simulation

Smoke Simulation

gpu-io

GPU Gems, Chapter 38: Fast Fluid Dynamics Simulation on the GPU

FBO Particles

Stable Fluids, Jos Stam

Rendering Water Using Compute Shaders and Navier Stokes Equations, Ivan Krukov

Deliverables
Project Proposal

Milestone Status Report

Milestone Presentation Slides

Final Presentation Slides

Fluid Collision Simulator
