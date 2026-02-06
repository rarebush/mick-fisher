https://clintbellanger.net/articles/

Isometric Tiles Introduction
This beginners tutorial is for those curious about making a game using isometric tiles. We'll cover the very basics of what isometric tiles are, why they're useful, and basic decisions to make when choosing isometric tiles.

Common Projections
The visual world around us is three dimensional, but the games we play (for now) are on a 2D screen. "Projection" is, in simple terms, the way we "flatten" a 3D view into 2D.

Die projected in three views
Three common projections of the same object

There are several popular projections used in 2D games. The most popular by far is to have the camera exactly on a major axis. This is common in puzzle games and side scrollers, where each tile is a simple square and the third dimension isn't visible at all. This view is often directly overhead, or directly from one side. If we look at a cube in this view, only one side would be visible (just the facing side).

Nikki and the Robots tiles example
Nikki and the Robots: side view

Side note: I highly recommend making a game or tile set using this simple projection before moving up to isometric! Basically everything that applies to a flat 2D game also applied to isometric, but isometric adds an extra layer of calculations.

The next most common projection still uses square shaped tiles, but changes the angle of the camera so we can see the third dimension. Games using this projection add movement in that third dimension. We see this projection common in early console-style RPGs and side scrolling beat-em-ups. Our virtual "camera" is angled in one direction to get this view. If we look at a cube in this view, two sides are visible (the top and facing side).

Liberated Pixel Cup tiles example
Liberated Pixel Cup: top + side view

For Isometric Projection we angle our camera along two axes (swing the camera 45 degrees to one side, then 30 degrees down). This creates a diamond (rhombus) shaped grid where the grid spaces are twice as wide as they are tall. This style was popularized by strategy games and action RPGs. If we look at a cube in this view, three sides are visible (top and two facing sides).

Flare tiles example
Flare: isometric view

There are many other less-common projection styles available for 2D games. The grid can be at a 45 degree angle but use "square" grid spaces as seen in Ultima Online. Or the grid can be square and 90 degree angles, with walls rising at 45 degrees as seen in Ultima 7. Or the camera can be turned so that each axis is affected differently as in the original Fallout games (which actually use a hex grid).

Isometric Specifics
In true isometric projection, grid lines are all at 30 degrees and each segment represents the same length -- making it useful in engineering diagrams.

Isometric diagram of struts and gears
Isometric engineering diagram from 1822

In video games when we say "isometric" we usually mean a view that's not exactly isometric. Video game isometric prefers a slightly different angle because we're working with whole pixels.

The following diagram shows several lines drawn in pixels (zoomed in to see details). Notice how the green lines look nice while the red lines look jagged. This is because the green lines are using specific slopes that fit exactly on a pixel grid. Our isometric line is the 1:2 slope -- draw two pixels horizontally for every one pixel vertically. This means each isometric grid space is exactly twice as wide as it is tall (see the blue isometric outline).

Video game pixel slopes
Nice vs. jagged pixel lines

Because of this predictable 1:2 slope it is easy to create pixel art in isometric style. It's also easy to render 3D art in isometric projection. In Blender we can use an orthographic camera to create isometric art:

Camera angle (60, 0, 45) for video-game style isometric (tiles that are 2x wide as they are tall)
Camera angle (54.736, 0, 45) for true engineering isometric (but jagged edges due to the angles)
The pseudo-isometric projection not only makes pixel art crisp, but makes map coordinates easy to handle. Every grid space is exactly 2x wide as it is tall, so calculating the screen position of a particular grid space is straight forward.

Choosing a Tile Size
Generally a game will use the same base tile size for the entire project. So choosing the right size from the beginning is an important task.

First there's the pixel dimensions of the tile. In all video game art it's common to stick with powers-of-two dimensions for images. So the most common grid size of isometric games are 32x16, or 64x32, or 128x64. Note that it's not really necessary to use a power of two. You might decide 100x50 is easier to work with. Sticking with powers of two might allow you to do nifty computing tricks (bit shifting instead of multiplying/dividing). If you plan to make tiles that are reusable in other projects/games, it's probably smart to stick with the traditional sizes.

Tile size examples. 32x16, 64x32, and 128x64
Common tile sizes

32x16 is a very small size but still useful on mobile devices or if using scaled-up pixel art.
64x32 is a common modern tile size, flexible for many game types.
128x64 is good for games with a high level of detail or displayed on HD resolutions.
Even if you choose e.g. 64x32 base grid size, that doesn't mean every image in your game will be 64px by 32px. It's common in isometric games to have tall tiles that align with the bottom of the grid. A game using 64x32 might actually use 64px x 128px images for objects such as walls -- or rather, each section of wall that fits exactly on one grid space. Using tall tiles is useful for drawing objects in the correct z-order. But more on that another time.

Once you choose a tile size, you still need to think about what that tile size represents in 3D space:

Tile scale examples. 1km scale is a mountain. 10m scale is a house. 1m scale is a person.
Example tile scales

If you're making a world conquest turn-based strategy, each tile might represent a 1km square area or more.
If you're making a city building simulation, one tile might be a 10m x 10m square. This could be the width of a city street or size of a small building.
If you're making an RPG where the focus is on one hero, each tile might represent 1m square.
This really depends on the genre of game and on the target display size. I suggest mocking up screens of your game to get a feel for what size and scale will work best. Then, choose a scale and stick with it. It will be easier to create matching assets when you know exactly what size each tile represents.

That's it for our introduction. In the next part of this series we'll look at approaches to making floor and wall tiles. If you have questions about isometric tiles that you'd like me to answer during this series, please drop me a message!

About the Author
Clint Bellanger is a software developer who has been experimenting with video game code for 30 years and 3D art for 20 years. His latest project is Flare, a Free/Libre action roleplaying engine.

This document is released under CC-BY-SA and the GFDL.

Isometric Tiles Math
Working with isometric tiles is a bit trickier than a plain square grid. This tutorial is for beginner game programmers looking to wrap their heads around isometric math. Instead of simply handing you formulas, I intend to explain what they do and how they should be used.

There are many ways of handling isometric tiles but we're only going to talk about one method. This happens to be the most commonly used method. It's the way that isometry is handled in the Tiled map editor, so it's definitely a good approach if you want to use that tool.

Orthographic Projection
When working in isometric project, your maps will still be a simple 2D array (or equivalent) in memory -- just as if you were working in a simpler orthographic projection (e.g. side or top view).

Our grid in "map" coordinates -- how our array looks in memory, Values are (map.x, map.y)

If you've worked with a regular square grid before (which I recommend before trying isometric), the math works out pretty simple. Drawing a tile to screen is simply taking the tile's coordinates and multiplying by the tile size to get the screen position:

screen.x = map.x _ TILE_WIDTH;
screen.y = map.y _ TILE_HEIGHT;
In this example our tiles are 64x64 pixels. If we want to display the tile at position (2,1), we plug the values into our formulae:

screen.x = 2 _ 64; // equals 128 px
screen.y = 1 _ 64; // equals 64 px

Determining the screen position for a tile in Orthographic Projection

Isometric Projection
This figure shows how we want to project our memory tiles to the screen in Isometric view.

We want our map to look like this on the screen

In this example our isometric tiles are 128x64 pixels. Let's draw tile 2,1 again, but this time in isometric projection. First let's measure some pixels to see where tile 2,1 is on the screen compared to the origin point -- so we know what answer we're working towards.

Tile 2,1 position in screen pixels is 64,96

Here's where it's easy to get brain-bent. It's possible to calculate rotation and y-scale to do this, but there's a simpler way. The trick is to think of x and y separately. Observe the following about this isometric projection.

Increasing map X by +1 tile (going "right" in map coordinates) increases both screen X and Y (going "right + down" in screen coordinates). If we measure in our example, we'll see that it increases screen.x by 64 (half our tile's width) and screen.y by 32 (half our tile's height).

map.x++ affects screen pixels by +64,+32

Similarly, increasing map Y by +1 tile (going "down" in map coordinates) decreases screen X and increases screen Y (going "left + down" in screen coordinates).

Expressing those changes as code looks something like this:

// helper constants used throughout these isometric formulas
TILE_WIDTH = 128;
TILE_WIDTH_HALF = 64;
TILE_HEIGHT = 64;
TILE_HEIGHT_HALF = 32;

screen.x = map.x _ TILE_WIDTH_HALF - map.y _ TILE*WIDTH_HALF;
screen.y = map.x * TILE*HEIGHT_HALF + map.y * TILE_HEIGHT_HALF;
And with some simplification we get the basic formula for isometric projection:

screen.x = (map.x - map.y) _ TILE_WIDTH_HALF;
screen.y = (map.x + map.y) _ TILE_HEIGHT_HALF;
Let's test the formula on tile 2,1 to see if we get the expected result:

screen.x = (2 - 1) _ 64; // equals 64
screen.y = (2 + 1) _ 32; // equals 96
Projecting from Screen pixels back to Map position
Now a square grid is easy to work with. Probably all of your game calculations (e.g. collisions) will happen in square map coordinates. You only project to screen pixels when you need to draw something.

Sometimes though you have to convert screen pixels back to map coordinates. Example: the player clicks on a pixel; how do we reverse the formula and find the tile?

Rather than figure out the formula from the inputs/outputs this time, we're going to use good old Algebra to reverse the functions.

// Basic isometric map to screen is:
screen.x = (map.x - map.y) _ TILE_WIDTH_HALF;
screen.y = (map.x + map.y) _ TILE_HEIGHT_HALF;

// Solve the first equation for map.x
screen.x == (map.x - map.y) \* TILE_WIDTH_HALF
screen.x / TILE_WIDTH_HALF == map.x - map.y
map.x == screen.x / TILE_WIDTH_HALF + map.y

// Solve the second equation for map.y
screen.y == (map.x + map.y) \* TILE_HEIGHT_HALF
screen.y / TILE_HEIGHT_HALF == map.x + map.y
map.y == screen.y / TILE_HEIGHT_HALF - map.x

// Replace "map.y" in the first equation with what it equals in the second
map.x == screen.x / TILE_WIDTH_HALF + map.y
map.x == screen.x / TILE_WIDTH_HALF + screen.y / TILE_HEIGHT_HALF - map.x
2(map.x) == screen.x / TILE_WIDTH_HALF + screen.y / TILE_HEIGHT_HALF
map.x == (screen.x / TILE_WIDTH_HALF + screen.y / TILE_HEIGHT_HALF) /2

// And now do the same for map.y
map.y == screen.y / TILE_HEIGHT_HALF - (screen.x / TILE_WIDTH_HALF + map.y)
map.y == screen.y / TILE_HEIGHT_HALF -(screen.x / TILE_WIDTH_HALF) - map.y
2(map.y) == screen.y / TILE_HEIGHT_HALF -(screen.x / TILE_WIDTH_HALF)
map.y == (screen.y / TILE_HEIGHT_HALF -(screen.x / TILE_WIDTH_HALF)) /2

// So final actual commands are:
map.x = (screen.x / TILE_WIDTH_HALF + screen.y / TILE_HEIGHT_HALF) /2;
map.y = (screen.y / TILE_HEIGHT_HALF -(screen.x / TILE_WIDTH_HALF)) /2;

Given screen pixel coordinates 64,96, we expect to project back to tile (2,1)

map.x = (screen.x / TILE_WIDTH_HALF + screen.y / TILE_HEIGHT_HALF) /2;
map.x = (64 / 64 + 96 / 32) /2;
map.x = (1 + 3) /2;
map.x = 2;

map.y = (screen.y / TILE_HEIGHT_HALF -(screen.x / TILE_WIDTH_HALF)) /2;
map.y = (96 / 32 - (64 / 64)) /2;
map.y = (3 - 1) /2;
map.y = 1;

Notes
Notice that the "origin" of the isometric tile is the top corner. But usually when we draw a sprite it's from the top-left corner. Before drawing you may want to adjust by the tile's size. Example for regular sized tiles: screen.x -= TILE_WIDTH_HALF;

These formulas also don't account for a camera. Essentially a camera is a drawing offset, just as in an Orthographic game. The middle of our projected map is at x=0, so if you want it centered on the screen it's like having a camera offset: screen.x += SCREEN_WIDTH_HALF;

Note that these formulas work for sub-tile positions as well. Assuming you're doing all floating-point math, the map position (2.5, 1.5) will become screen position (64.0, 128.0) and vice versa.

If you're going to use floats anyway, you can simplify the screen_to_map functions slightly (because you're not concerned with integer division).

// factored out the constant divide-by-two
// only if we're doing floating-point division!
map.x = screen.x / TILE_WIDTH + screen.y / TILE_HEIGHT;
map.y = screen.y / TILE_HEIGHT - screen.x / TILE_WIDTH;
I suggest setting up two utility functions for quick conversion between screen and map coordinates. Remember to do all the actual calculations in map coordinates, and only project to/from screen coordinates for inputs (click/touch) and outputs (rendering).

Point map_to_screen(Point map_coordinates);
Point screen_to_map(Point screen_pixels);
