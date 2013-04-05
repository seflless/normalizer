// To make it easier to find public normalizer functions I implement all functions at
// the bottom of this file and assign them to their public name. 
// All implementations are the same as their public name but 'Impl' added to the end.

// Remembering that variable names get lifted to the top of their containing scope so this works in that you can assign
// a function to a variable above where it is defined.
// above where
(function(){
normalizer = {};// Create Name Space
//------------ API -------------
	// Create Normals From Axis Light Images
	normalizer.create = createImpl;
	
	// Calculate Lighting
	normalizer.light = lightImpl;
	
	// Create Color Channels
	normalizer.channels = channelsImpl;
	
	// Smooth the normal map to reduce imperfections in a normal map
	normalizer.smooth = smoothImpl;
	
	// Low-Level API
	
	// Normalize Normal
	normalizer.normalize = normalizeImpl;
	
	// Convert a normals to a color
	normalizer.normalToColor = normalToColorImpl;
	
	// Convert a color to a normal
	normalizer.colorToNormal = colorToNormalImpl;
	
//------------ End API -------------

	// Internal Singleton Variables
		// This is a cache of floating point versions of the normal map images.
		// There are actually 3 arrays per normal map image. One for each color channel.
	var normalMapArraysCache = [];
	
	//	
	// Implementations:
	//
	
	// Create Normals From Axis Light Images
	function createImpl(options){
		// Sanity check passed in image parameters
		validateAxisImages(options.images);

		// If no onFinish callback was passed raise an exception because it's pointless to create a normal map
		// if you can't tell when it's finished being created and what it has created.
		if(!options.onFinish)
			throw 'No onFinish() callback provided. Pointless to continue';

		// Make sure all non passed in options have proxies to make the code simpler
		var onStart = options.onStart?options.onStart:function(){},
			onProgress = options.onProgress?options.onProgress:function(){},
			onFinish = options.onFinish;
			delay = options.delay?options.delay:0,// Delay between incremental calculations. (milliseconds)
			chunkWidth=options.chunkWidth?options.chunkWidth:32,
			chunkHeight=options.chunkHeight?options.chunkHeight:32,
			xOffset = chunkWidth*0,	// Leaving these offsets in for testing reasons
			yOffset = chunkHeight*0;//
		
		// Preload the images before actually doing anything.
		// Count the amount of images in the images associative map
		// so that we know when we've loaded the last image.
		//			
		// Note: There must be a better way, too busy to figure it out.
		var imageCount = 0;
		for(var i in options.images){imageCount++;}
		
		var images = {},
			canvases = {},
			width,
			height;
		for(var img in options.images){
			var newImage = new Image();
			newImage.onload=function(){
				// Store Image dimensions, ensure that all of them are the same.
				width=width?width:this.width;
				height=height?height:this.height;
				if(width!=this.width||height!=this.height){
					throw 'All images need to be the same dimensions.';
				}
				
				// Figure out if we are finished loading our last image.
				imageCount--;
				if(!imageCount){
					// The coordinates space we are using is
					//		   -Y    
					// 			^  -Z
					// 			|  /
					//          | /
					// -X <---- 0 ----> +X
					//         /|
					//		  /	|
					//		 /	V
					//	  +Z   +Y
					
					// Create a canvas version of the image so we can get pixel data
					for(var i in images){
						canvases[i] = createCanvas(images[i].width,images[i].height);
						canvases[i].getContext("2d").drawImage(images[i],0,0);
					}
				
					// Create Normal Map Canvas, then get the pixel data
					// reference
					var nmCanvas = createCanvas(width,height),
						nmCtx = nmCanvas.getContext("2d"),
						nmData = getImageData(nmCanvas),
						nmDataCached = nmData.data;
					
					
					// Copy the front image to another canvas so that it can be returned in onFinish callback
					// and used as the diffuse lighting component for drawing the lit object after all this.
					var diffuseCanvas = createCanvas(width,height);
					diffuseCanvas.getContext('2d').drawImage(canvases.front,0,0);
				
					// We are down loading everything and creating the canvases for them. Notify caller that we are at this phase
					// Incase they want to draw anything
					onStart({
						normals: nmCanvas,
						axises: canvases,
						diffuse: diffuseCanvas
					})
				
					// Now calculate the normals.

					// Incrementally calculate everything in phases
					// greyScaleImages -> colorAdjustImages -> Calculate Normals.
				
					// If the delay is 0, then just set ChunkWidth to the canvasWidth to speed up the processing.
					if(delay<=0)
						chunkWidth = nmCanvas.width;
					if(delay<=0)
						chunkHeight = nmCanvas.height;
					
					function onProgressImpl(x,y,width,height,canvasName){
						onProgress({
							normals: nmCanvas,
							axises: canvases,
							diffuse: diffuseCanvas,
							x:x,y:y,
							width:width,height:height,
							// Which Canvas
							canvasName:canvasName
						});
					}
					
					// Preprocess canvas version of photos. (Grey scale and color range correction)
					// This is slow because it takes multiple passes per preprocessed image
					
					//------------------------------------
					// Gray Scale Conversion Phase
					//------------------------------------
						// the Current min/max are passed through each phase and updated if a new min or max is found
					var range ={
						min: 255,
						max: 0
					};
					function genGreyScaleCB(canvas){
						return function(x,y,clippedWidth,clippedHeight){
							greyScaleImage(canvas,x,y,clippedWidth,clippedHeight,range);
						};
					};
					incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"left",genGreyScaleCB(canvases.left),onProgressImpl,function(){
					
						incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"right",genGreyScaleCB(canvases.right),onProgressImpl,function(){
						
							incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"front",genGreyScaleCB(canvases.front),onProgressImpl,function(){
							
								incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"back",genGreyScaleCB(canvases.back),onProgressImpl,function(){
								
									incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"top",genGreyScaleCB(canvases.top),onProgressImpl,function(){
									
										incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"bottom",genGreyScaleCB(canvases.bottom),onProgressImpl,function(){
											//------------------------------------
											// Color Range Adjustment Phase
											//------------------------------------
											function gencolorRangeAdjustImageCB(canvas){
												return function(x,y,clippedWidth,clippedHeight){
													colorRangeAdjustImage(canvas,x,y,clippedWidth,clippedHeight,range);
												};
											}
											
											// This is used in to places make a utility function
											function calcNormals(){
												function calculateNormalsCB(x,y,clippedWidth,clippedHeight){
													calculateNormals(
														nmCanvas,nmData,nmDataCached,
														getImageData(canvases.left).data,getImageData(canvases.right).data,
														getImageData(canvases.front).data,getImageData(canvases.back).data,
														getImageData(canvases.top).data,getImageData(canvases.bottom).data,
														x,y,clippedWidth,clippedHeight
													);
												};
									
												incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"normals",calculateNormalsCB,onProgressImpl,function(){
													// Now that we are finished call onFinish()
													onFinish({
														normals: nmCanvas,
														axises: canvases,
														diffuse: diffuseCanvas
													});
												});	// Calculate Normals closing parentheses
											}
											
											if(options.colorAdjust){
												incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"left",gencolorRangeAdjustImageCB(canvases.left),onProgressImpl,function(){
													
													incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"right",gencolorRangeAdjustImageCB(canvases.right),onProgressImpl,function(){
													
														incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"front",gencolorRangeAdjustImageCB(canvases.front),onProgressImpl,function(){
																							
															incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"back",gencolorRangeAdjustImageCB(canvases.back),onProgressImpl,function(){
																																												
																incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"top",gencolorRangeAdjustImageCB(canvases.top),onProgressImpl,function(){
																					
																	incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,nmCanvas.width,nmCanvas.height,"bottom",gencolorRangeAdjustImageCB(canvases.bottom),onProgressImpl,function(){
																		//------------------------------------
																		// Calculate Normals Phase
																		//------------------------------------	
																		calcNormals();																	 
																	})
																})
															})
														})
													})
												}); // Color Range Adjustment Phase closing parentheses  
											} 
											// Skipped Color Adjust Phase
											else{
												//------------------------------------
												// Calculate Normals Phase
												//------------------------------------
												calcNormals();
											}
										})
									})
								})
							})
						});
					}); // Grey Scale Phase closing parentheses
				}
			}
			// Make sure non of our images fail to load
			newImage.onerror=function(){
				throw 'Image failed to load in normalizer.js';
			}
			images[img] = newImage
			newImage.src=options.images[img];
		}
	}
	
	function lightImpl(normalsCanvas,l,c){
		// Just to make sure, normalize the light vector
		l = normalizeImpl(l);
		// Reverse it too so that the proper dot product is used.
		l = scaleVector(l,-1);

		// Create non hash table versions of the light fields (Faster than member access in render loop below)
		var	lX=rL.x,
			lY=rL.y,
			lZ=rL.z;
	
		var nmData = normalizer.getImageData(nmCanvas),
			nmDataCached = nmData.data,
			outData = normalizer.getImageData(outCanvas),
			outDataCached = outData.data;
			
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			offset,x,y,d,c,n,r,g,b,realOffset=0,
			realX=realNormalsX,
			realY=realNormalsY
			realZ=realNormalsZ,
			width=imageWidth,
			height=imageHeight;
		for(y = 0; y<height; y++){
			offset=yOffset;
			for(x = 0; x<width; x++){
				// Inline normalizer.dotProduct
				d = realX[realOffset]*lX+realY[realOffset]*lY+realZ[realOffset]*lZ;//+dy+dz;
				
				// Remember that normals were already scaled in createRealNormals() to be of length 255 instead of 1. This removes a multiplication of 255 see below.
				if(d<=0.0){
					c = 255;
				}
				else{
					// No longer need to multiply d by 255, because the dot product is equal to cos(angleBetweenThem)*vectorALength*vectorBLength 
					// (In this case the normal is of length 255 and the light 1 so the math works out perfectly
					c = 255-d;
				}
				outDataCached[offset+3] = c;
			
				offset+=4;
				realOffset++;
			}
			yOffset+=quadrupleWidth;
		}
		normalizer.putImageData(outCanvas,outData);	
				
					
	}
	
	function channelsImpl(diffuse){
		var channels=[],
			// Channel Indexes to mask out given a channel. For example the red channel is offset+0
			// while green/blue are 1/2. So for red we mask out: 1,2
			chMasks=[
				[1,2],
				[0,2],
				[0,1]
			],
			width=diffuse.width,
			height=diffuse.height;
		for(var i = 0; i<3; i++){
			// Create a canvas for this color channel
			var chCanvas = createCanvas(width,height),
				chCtx = chCanvas.getContext('2d');
			
			// Initialize it to the values of the diffuse map
			chCtx.drawImage(diffuse,0,0);
			
			// Zero out the other two channels' values
				// Store the masks indexes as vars for quicker access than arrays
			var a = chMasks[i][0],b = chMasks[i][1]; 

			// Get Image data for pixel manipulation
			var chData = getImageData(chCanvas),
				chDataCached = chData.data;
							
			var yOffset = 0,
				quadrupleWidth = 4*width,
				offsetA,offsetB;
			for(var y = 0; y<height; y++){
				offsetA=yOffset+a;
				offsetB=yOffset+b
				for(var x = 0; x<width; x++){
					chDataCached[offsetA] = 0;
					chDataCached[offsetB] = 0;
					offsetA+=4;
					offsetB+=4;
				}
				yOffset+=quadrupleWidth;
			}

			// Now set the new pixels values
			putImageData(chCanvas,chData);
			channels[i]=chCanvas;
		}
		return {
			red:channels[0],
			green:channels[1],
			blue:channels[2]
		};
	}
	
	// Implementation of smooth algorithm
	
	function smoothImpl(options){
		// If no onFinish callback was passed raise an exception because it's pointless to create a normal map
		// if you can't tell when it's finished being created and what it has created.
		if(!options.onFinish)
			throw 'No onFinish() callback provided. Pointless to continue';

		// Make sure all non passed in options have proxies to make the code simpler
		var onProgress = options.onProgress?options.onProgress:function(){},
			onFinish = options.onFinish;
			delay = options.delay?options.delay:0,// Delay between incremental calculations. (milliseconds)
			chunkWidth=options.chunkWidth?options.chunkWidth:32,
			chunkHeight=options.chunkHeight?options.chunkHeight:32;
	
		// Create two copies of the supplied normals canvas so that we can apply a filter non destructably
		// ie. we get images from the copy and assign it to the original otherwise we'll be over filtering
		// because you'll be blending with already blended pixels
			// The first one stores the original map, the second holds the results of the current progress
		var tempInput = createCanvas(options.normals.width,options.normals.height),
			tempOutput = createCanvas(options.normals.width,options.normals.height);
		// Copy Original
		tempInput.getContext('2d').drawImage(options.normals,0,0);
		
		function smoothCB(x,y,width,height){
			smoothIncrementalImpl(tempInput,tempOutput,x,y,width,height);
		}
		
		function onProgressImpl(x,y,width,height,canvasName){
			onProgress({
				normals: tempOutput,
				x:x,y:y,
				width:width,height:height
			});
		}
		
		// Incrementally calculate it now.
		incrementallyCalculatePhases(xOffset,yOffset,chunkWidth,chunkHeight,delay,options.normals.width,options.normals.height,"",smoothCB,onProgressImpl,function(){
			// Copy final results in normals canvas
			options.normals.getContext('2d').drawImage(tempOutput,0,0);	
		
			onFinish({
				normals: options.normals
			});
		});
	}
	
	// Actual Calculations that support incremental calculations
	// TODO: Make this smarter, would like to preserve details without having hardedged artifacts. For
	// now we'll stick to simple smoothing.
	function smoothIncrementalImpl(tempInput,tempOutput,offsetX,offsetY,width,height){
		// Adjust offsets, and dimensions so that we don't sample outside our territory.
		// Basically process all pixels in this chunk, except on the edges, where you shrink or
		// offset the chunk location to not smooth the outside 1 pixel edge. You can't
		// smooth their sanely anyway due to not having 8 neighbor pixels
		// TODO: Add support for the edges to smooth with whatever neighbors they do have.
		if(offsetX==0){
			offsetX=offsetX+1;
			width--;
		}
		if(offsetY==0){
			offsetY=offsetY+1;
			height--;
		}
		width=(offsetX+width<(tempInput.width-1))?width:width-1;
		height=(offsetY+height<(tempInput.height-1))?height:height-1;
		
		var outputData = getImageData(tempOutput);
			outputDataCached = outputData.data;
			
		var inputData = getImageData(tempInput),
			inputDataCached = inputData.data;
		
		var width=width,
			height=height,
			quadrupleWidth = 4*tempInput.width,
			yOffset = offsetY*quadrupleWidth+offsetX*4,
			offset,x,y,
			averageScalar = 1/9;

		for(y = 0; y<height; y++){
			offset=yOffset;
			for(x = 0; x<width; x++){
				var TL = colorToNormalImpl(
						inputDataCached[offset-quadrupleWidth-4],
						inputDataCached[offset+1-quadrupleWidth-4],
						inputDataCached[offset+2-quadrupleWidth-4]
					),
					T = colorToNormalImpl(
						inputDataCached[offset-quadrupleWidth],
						inputDataCached[offset+1-quadrupleWidth],
						inputDataCached[offset+2-quadrupleWidth]
					),
					TR = colorToNormalImpl(
						inputDataCached[offset-quadrupleWidth+4],
						inputDataCached[offset+1-quadrupleWidth+4],
						inputDataCached[offset+2-quadrupleWidth+4]
					),
					R = colorToNormalImpl(
						inputDataCached[offset+4],
						inputDataCached[offset+1+4],
						inputDataCached[offset+2+4]
					),
					BR = colorToNormalImpl(
						inputDataCached[offset+quadrupleWidth+4],
						inputDataCached[offset+1+quadrupleWidth+4],
						inputDataCached[offset+2+quadrupleWidth+4]
					),
					B = colorToNormalImpl(
						inputDataCached[offset+quadrupleWidth],
						inputDataCached[offset+1+quadrupleWidth],
						inputDataCached[offset+2+quadrupleWidth]
					),
					BL = colorToNormalImpl(
						inputDataCached[offset+quadrupleWidth-4],
						inputDataCached[offset+1+quadrupleWidth-4],
						inputDataCached[offset+2+quadrupleWidth-4]
					),
					L = colorToNormalImpl(
						inputDataCached[offset-4],
						inputDataCached[offset+1-4],
						inputDataCached[offset+2-4]
					),
					S = colorToNormalImpl(
						inputDataCached[offset],
						inputDataCached[offset+1],
						inputDataCached[offset+2]
					);
					
				// Average it all together
					// First scale down each down by their contributions (1/9 for 9 samples)
				TL = scaleVector(TL,averageScalar);
				T = scaleVector(T,averageScalar);
				TR = scaleVector(TR,averageScalar);
				R = scaleVector(R,averageScalar);
				BR = scaleVector(BR,averageScalar);
				B = scaleVector(B,averageScalar);
				BL = scaleVector(BL,averageScalar);
				L = scaleVector(L,averageScalar);
				S = scaleVector(S,averageScalar);
					// Add them all together
				var n =	addVector(TL,
						addVector(T,
						addVector(TR,
						addVector(R,
						addVector(BR,
						addVector(B,
						addVector(BL,
						addVector(L,S))))))));
				n = normalizeImpl(n);
				var c = normalToColorImpl(n);
				
				// Set the color based on the smoothed normal
				outputDataCached[offset] = c.r;
				outputDataCached[offset+1] = c.g;
				outputDataCached[offset+2] = c.b;
				
				// Copy over alpha incase original image had transparent values(Values that aren't 255)
				outputDataCached[offset+3] = inputDataCached[offset+3];
				

				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		putImageData(tempOutput,outputData);
	}
	
	//
	// Utitility Functions
	// 
	
	// Creates Normal Map Arrays if they don't already exist for the passed in normal Canvas. Stored are the x,y,z version of the Normal Map Image's normals.
	// This creates 3 versions so that we can remove 2 additions in the render loop as they will all have the same index
	// These are stored in a cache based on the passed in normal map canvas so they can be looked up again after being calculated the first time.
	// Additionally the floats are pre-multiplied by 255 so that we don't have to scale the dot product up to the 0-255 range in the inner loop
	function getCachedNormalArrays(normalsCanvas){
		// Search first in the cache
		for(var cached in normalMapArraysCache){
			if(normalMapArraysCache[cached].canvas==normalsCanvas)
				return normalMapArraysCache[cached].arrays;
		}
	
		var nmData = normalizer.getImageData(normalsCanvas),
			nmDataCached = nmData.data,
			yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			r,g,b,
			realOffset=0;
			
		realNormalsX = new Array(imageWidth*imageHeight);
		realNormalsY = new Array(imageWidth*imageHeight);
		realNormalsZ = new Array(imageWidth*imageHeight);

		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
			
				r = nmDataCached[offset];
				g = nmDataCached[offset+1];
				b = nmDataCached[offset+2];
				if(r<=127)
					r = -(1.0-r/127.0);
				else
					r = (r-128.0)/128.0;
				if(g<=127)
					g = -(1.0-g/127.0);
				else
					g = (g-128.0)/128.0;
				if(b<=127)
					b = -(1.0-b/127.0);
				else
					b = (b-128.0)/128.0;
				
				r*=255;
				g*=255;
				b*=255;
				
				realNormalsX[realOffset]=r;
				realNormalsY[realOffset]=g;
				realNormalsZ[realOffset]=b;
			
				offset+=4;
				realOffset++;
			}
			yOffset+=quadrupleWidth;
		}
		
	}
	
	
	// Utility function for doing incremental calculations of images.
	function incrementallyCalculatePhases(x,y,chunkWidth,chunkHeight,delay,width,height,canvasName,cb,onProgress,onFinish){
		// Clip Chunk width/height to ensure that we don't read pixels that are outside the image
		var clippedWidth = (x+chunkWidth<=width)?chunkWidth:width-x,
			clippedHeight=(y+chunkHeight<=height)?chunkHeight:height-y;	
		
		// Call passed in incremental calculation function
		cb(x,y,clippedWidth,clippedHeight);
		
		// Callback function provided by user so that they can display the current progress
		// Don't call it if there isn't a delay value greater than zero
		if(delay>0){
			onProgress(x,y,clippedWidth,clippedHeight,canvasName);
		}
		
		// Calculate next block of pixels to process.
			// Increment the current x, if it passes the right edge, start at the left of the next line
		x+= chunkWidth;
		if(x>=width){
			y+=chunkHeight;
			x= 0;
		}
		
		if(y>=height){
			// If we have passed the bottom, call onFinish() and get out of here.
			onFinish();
			return;
		}
		
		// If we are supplied a delay value greater than zero use a timer callback, otherwise just call it right away.
		if(delay<=0){
			incrementallyCalculatePhases(x,y,chunkWidth,chunkHeight,delay,width,height,canvasName,cb,onProgress,onFinish);
		}
		else{
			// Give the UI/Browser a bit of time. (Sort of like sleep, but um not as good.)
			// This will call back self but with update x,y
			setTimeout(function(){
				incrementallyCalculatePhases(x,y,chunkWidth,chunkHeight,delay,width,height,canvasName,cb,onProgress,onFinish);
			},delay);
		}
	}
	
	// Creates a canvas based on width/height passed in
	function createCanvas(width,height){
		var canvas = document.createElement('CANVAS');  
		canvas.setAttribute('width',width);  
		canvas.setAttribute('height',height);
		return canvas;
	}
	
	// Makes sure we received all the images we expect, not too many or not enough
	function validateAxisImages(images){
		var expected = {left:1,right:1,front:1,back:1,top:1,bottom:1},
			count = 0;
		for(var i in images){
			if(expected[i]!=1){
				throw 'Invalid field. Got "'+i+'". Expected "left","right","front", "back", "top", or "bottom".';
			}
			count++;
		}
		// Check that there were exactly 6 images.
		if(count!=6){
			throw 'Too many or not enough images supplied.';
		}
	}
	
	// Find the color channel with the highest value for this pixel
	function maxChannel(data,offset){
		return Math.max(data[offset],Math.max(data[offset+1],data[offset+2]));
	}
	
	// Find the color channel with the lowest value for this pixel
	function minChannel(data,offset){
		return Math.min(data[offset],Math.min(data[offset+1],data[offset+2]));
	}
	
	// Map color to new range instead of min->max, it will 0->255
	function levelChannel(ch,min,max){
		if(max==0)
			return 0;
		ch = Math.min(Math.floor((ch-min)*(255.0/(max-min))),255);
		return ch;
	}
	
	function getImageData(canvas){
		if(!canvas){
			var what = "who";
		}
		var ctx = canvas.getContext('2d');
		var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
		return imageData;
	}
	function putImageData(canvas,data){
		if(!canvas){
			var i = 10;
		}
		var ctx = canvas.getContext('2d');
		ctx.putImageData(data,0,0);
	}
	
	// Preprocess canvas version of photos. (Grey scale and color range correction)
		// Additionally start at the offset locations, and only process the width*height chunk of the pixels.
		// The current min/max is passed in too.
		// The min/max will be used in the next phase of this. The colorAdjustImage() phase.
	function greyScaleImage(canvas,offsetX,offsetY,width,height,range){
		var data = getImageData(canvas);
			dataCached = data.data;
			
		
		
		var quadrupleWidth=4*canvas.width,
			yOffset=offsetY*quadrupleWidth+offsetX*4,
			curMax,curMin;
			
		// grey scale everything and look for the 
		// min/max channel value in this whole image.
		var x,y,offset;
		for(y = 0; y<height; y++){
			offset=yOffset;
			for(x = 0; x<width; x++){
				curMax = maxChannel(dataCached,offset);
				curMin = minChannel(dataCached,offset);
				
				dataCached[offset] = curMax;
				dataCached[offset+1] = curMax;
				dataCached[offset+2] = curMax;
				
				range.max=curMax>range.max?curMax:range.max;
				range.min=curMin<range.min?curMin:range.min;
				
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		
		putImageData(canvas,data);
	}
	
	// Adjust color range so that that lowest color is fully black, and highest is white,
	// and every other value gets scaled to the new range
	function colorRangeAdjustImage(canvas,offsetX,offsetY,width,height,range){
		var data = getImageData(canvas);
			dataCached = data.data;
			
		
			
		var ch = 0,
			quadrupleWidth=4*canvas.width,
			yOffset=offsetY*quadrupleWidth+offsetX*4,
			x,y,offset;
		for(y = 0; y<height; y++){
			offset=yOffset;
			for(x = 0; x<width; x++){
				// grab the red channel (all channels are equal due to grayscaling)
				ch = levelChannel(dataCached[offset],range.min,range.max);
				
				dataCached[offset] = ch;
				dataCached[offset+1] = ch;
				dataCached[offset+2] = ch;
				
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		
		putImageData(canvas,data);
	}
	
	function calculateNormals(
		normalsCanvas,normalsCanvasData,normalsDataCached,
		leftDataCached,rightDataCached,frontDataCached,backDataCached,topDataCached,bottomDataCached,
		offsetX,offsetY,width,height
	){
	
		// Calculate the normals at each pixel and then encode them into an rgb color.
		var quadrupleWidth=4*normalsCanvas.width,
			yOffset=offsetY*quadrupleWidth+offsetX*4,
			x,y,offset;
			
		for(y = 0; y<height; y++){
			var offset=yOffset;
			for(x = 0; x<width; x++){

				// Encode Normal for some details as to how to best
				// Convert Axis maps properly into a normal map
				// Some tricks have to be performed due to our
				// Axis Light Images being imperfect due to light
				// bouncing off things.
				var c = normalToColorImpl(channelsToNormal({
					r: [leftDataCached[offset],rightDataCached[offset]],
					g: [topDataCached[offset],bottomDataCached[offset]],
					b: [backDataCached[offset],frontDataCached[offset]]
				}));
				
				normalsDataCached[offset] = c.r;
				normalsDataCached[offset+1] = c.g;
				normalsDataCached[offset+2] = c.b;
				// Alpha
				normalsDataCached[offset+3]=255;
				
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		
		// Update the normal map with this new data
		putImageData(normalsCanvas,normalsCanvasData);
	}
	
	// Encodes a float with range [-1.0,1.0] into a color channel with range [0,255]
	function encodeFloat(f){
		if(f<0.0){
			f = -f;
			return Math.min(Math.floor((1.0-f)*127.0),127);
		}
		else{
			return 128+Math.min(Math.floor(f*128.0),128);
		}
	}
	
	// Encode a normal into a color
	function normalToColorImpl(n){
		var c = {};
		c.r = Math.floor(encodeFloat(n.x));
		c.g = Math.floor(encodeFloat(n.y));
		c.b = Math.floor(encodeFloat(n.z));
		return c;
	}
	
	// Calculate a normals length
	function normalLength(n){
		return Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z);
	}
	
	// Normalize a normal to a length of 1
	function normalizeImpl(n){
		var len = normalLength(n);
		if(len==0)
			return n;
		else{
			var invLen = 1.0/len;
			n.x *= invLen;
			n.y *= invLen;
			n.z *= invLen;
			return n;
		}
	}
	
	// Note: That because a pixel can be non zero brightness for oppositely shot lighting images,
	// We have to pick the brightest values as the lowered valued one is likely due to
	// light bouncing. Because technically something can't have both a positive x in a normal and
	// a negative one for example.
	function channelsToNormal(channels){
		var n = {};
		// x ( Left=Neg, Right=Pos )
		if(channels.r[0]>=channels.r[1]){
			n.x = -channels.r[0]/255.0;
		}
		else{
			n.x = channels.r[1]/255.0;
		}
		// y ( Top=Neg, Bottom=Pos )
		if(channels.g[0]>=channels.g[1]){
			n.y = -channels.g[0]/255.0;
		}
		else{
			n.y = channels.g[1]/255.0;
		}
		// z ( Back=Neg, Front=Pos )
		if(channels.b[0]>=channels.b[1]){
			n.z = -channels.b[0]/255.0;
		}
		else{
			n.z = channels.b[1]/255.0;
		}
	
	
		// Normalize the normal in case of inaccuracies. This generally occurs in non reflective places like hair or eye brows. The diffuse map
		// takes care of these by darkening them to the point that it generally doesn't matter but given enough lights additively combined it could
		// create subtle attenuations that might be good.
		//n = normalizeImpl(n);
		return n;
	}


	// Scale a vector by the magnitude passed in	
	function scaleVector(vector,magnitude){
		var o = {
			x: vector.x*magnitude,
			y: vector.y*magnitude,
			z: vector.z*magnitude
		};
		return o;
	}
	
	// Add to vectors together
	function addVector(v1,v2){
		var o = {
			x: v1.x+v2.x,
			y: v1.y+v2.y,
			z: v1.z+v2.z
		};
		return o;
	}

	// Decode a channel into a float value between -1.0 to 1.0
	function decodeChannel(ch){
		if(ch<=127)
			ch = -(1.0-ch/127.0);
		else
			ch = (ch-128.0)/128.0;
		return ch;		
	}
	
	// Decode a color into a normal
	function colorToNormalImpl(r,g,b){
		var n = {
			x: decodeChannel(r),
			y: decodeChannel(g),
			z: decodeChannel(b)
		};
		return n;
	}
	
	

	
})();