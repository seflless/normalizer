(function(){
  

	// Create Name Space
	normalizer = {};
	
	// private vars
	var images = {};
	var canvases = {};
	var mixerCanvas;
	var diffuseChannels = [];
	var diffuseCanvas;
	var imageWidth = 0,
		imageHeight = 0;
	var nmArray = [];
	var nmCanvas = null;
	var outCanvas = null;
	var lightingCanvas = null;
	var nmCanvasAdjusted = null;
	var nmCtx = null;
	var realNormalsX;
	var realNormalsY;
	var realNormalsZ;
	
	// Private Functions
	normalizer.createCanvas = function (width,height){
		var canvas = document.createElement('CANVAS');  
		canvas.setAttribute('width',width);  
		canvas.setAttribute('height',height);
		return canvas;
	}
	normalizer.createImageData = function (canvas){
		var data = normalizer.getContext(canvas).createImageData(canvas.width,canvas.height);
		return data;
	}
	
	normalizer.getWidth = function (){
		return imageWidth;
	}
	normalizer.getHeight = function (){
		return imageHeight;
	}
	
	normalizer.getContext = function (canvas){
		if(!canvas){
			var i = 10;
		}
		return canvas.getContext('2d');
	}
	normalizer.getImageData = function (canvas){
		var ctx = normalizer.getContext(canvas);
		var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
		return imageData;
	}
	normalizer.putImageData = function(canvas,data){
		var ctx = normalizer.getContext(canvas);
		ctx.putImageData(data,0,0);//0,0,data);
	}
	normalizer.channelsToNormal = function(channels){
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
		
		n = normalizer.normalize(n);
		return n;
	}
	normalizer.encodeChannel = function (neg,pos){
		if(neg>pos)
			pos = 0;
		else
			neg = 0;
		var halfNeg = Math.min(Math.floor(neg/2.0),127);
		var halfPos = Math.min(128+Math.floor(pos/2.0),255);
		var result = (halfNeg)+halfPos;
		return result;
	}
	function decodeChannel(ch){
		if(ch<=127)
			ch = -(1.0-ch/127.0);
		else
			ch = (ch-128.0)/128.0;
		return ch;		
	}
	function decodeColor(r,g,b){
		var n = {
			x: decodeChannel(r),
			y: decodeChannel(g),
			z: decodeChannel(b)
		};
		return n;
	}
	function encodeFloat(f){
		/*if(f==0.0)
			return 128;
		else */
		if(f<0.0){
			f = -f;
			return Math.min(Math.floor((1.0-f)*127.0),127);
		}
		else{
			return 128+Math.min(Math.floor(f*128.0),128);
		}
	}
	normalizer.encodeNormal = function(n){
		var c = {};
		c.r = Math.floor(encodeFloat(n.x));
		c.g = Math.floor(encodeFloat(n.y));
		c.b = Math.floor(encodeFloat(n.z));
		return c;
	}
	function normalLength(n){
		return Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z);
	}
	normalizer.normalize = function(n){
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
	normalizer.dotProduct = function(n,d){
		var dx = n.x*d.x;
		var dy = n.y*d.y;
		var dz = n.z*d.z;
		var d = dx+dy+dz;
		return d;
	}
	
	function channelMax(data,offset){
		return Math.max(data[offset],Math.max(data[offset+1],data[offset+2]));
	}
	function levelChannel(ch,maxCh){
		if(maxCh==0)
			return 0;
		ch = Math.min(Math.floor(ch*(255.0/maxCh)),255);
		return ch;
	}
	
	normalizer.createRealNormals = function(){
		var nmData = normalizer.getImageData(nmCanvas),
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
	
	normalizer.createAxisImagesFromNormal = function(normalsImage){
		canvases["left"] = normalizer.createCanvas(normalsImage.width,normalsImage.height);
		canvases["right"] = normalizer.createCanvas(normalsImage.width,normalsImage.height);
		canvases["front"] = normalizer.createCanvas(normalsImage.width,normalsImage.height);
		canvases["back"] = normalizer.createCanvas(normalsImage.width,normalsImage.height);
		canvases["top"] = normalizer.createCanvas(normalsImage.width,normalsImage.height);
		canvases["bottom"] = normalizer.createCanvas(normalsImage.width,normalsImage.height);
		
		var dataLeft = normalizer.getImageData(canvases["left"]),
			dataRight = normalizer.getImageData(canvases["right"]),
			dataFront = normalizer.getImageData(canvases["front"]),
			dataBack = normalizer.getImageData(canvases["back"]),
			dataTop = normalizer.getImageData(canvases["top"]),
			dataBottom = normalizer.getImageData(canvases["bottom"]);
		
		var dataCachedLeft = dataLeft.data,
			dataCachedRight = dataRight.data,
			dataCachedFront = dataFront.data,
			dataCachedBack = dataBack.data,
			dataCachedTop = dataTop.data,
			dataCachedBottom = dataBottom.data;
		
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			max = 0,
			data = normalizer.getImageData(normalsImage),
			dataCached = data.data;

		function extractAxisChannel(dataSrc,dataDst,offset,channel,positive){
			if(positive){
				dataDst[offset+3] = dataSrc[offset+3];
				dataDst[offset] =
				dataDst[offset+1] =
				dataDst[offset+2] = (dataSrc[offset+channel]>128)?(dataSrc[offset+channel]-128):0;
			}
			else{
				dataDst[offset+3] = dataSrc[offset+3];
				dataDst[offset] =
				dataDst[offset+1] =
				dataDst[offset+2] =(dataSrc[offset+channel]<=127)?(127-dataSrc[offset+channel]):0;
			}
		}
			
		var x,y,offset;
		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
				
				// x (right/left)
				extractAxisChannel(dataCached,dataCachedRight,offset,0,true);
				extractAxisChannel(dataCached,dataCachedLeft,offset,0,false);

				// y (bottom/top)
				extractAxisChannel(dataCached,dataCachedBottom,offset,1,true);
				extractAxisChannel(dataCached,dataCachedTop,offset,1,false);
				
				// z (front/back)
				extractAxisChannel(dataCached,dataCachedFront,offset,2,true);
				extractAxisChannel(dataCached,dataCachedBack,offset,2,false);
				
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
	/*	*/
		//
		normalizer.putImageData(canvases["left"],dataLeft);
		normalizer.putImageData(canvases["right"],dataRight);
		normalizer.putImageData(canvases["top"],dataTop);
		normalizer.putImageData(canvases["bottom"],dataBottom);
		normalizer.putImageData(canvases["front"],dataFront);
		normalizer.putImageData(canvases["back"],dataBack);
	}
	function preprocessCanvas(canvas){
		var data = normalizer.getImageData(canvas);
			dataCached = data.data;
		
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			max = 0,
			curMax;
			
		// grey scale everything and look for the 
		// brightest channel in this whole image
		var x,y,offset;
		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
				curMax = channelMax(dataCached,offset);
				dataCached[offset] = curMax;
				dataCached[offset+1] = curMax;
				dataCached[offset+2] = curMax;
				
				if(curMax>max)
					max=curMax;
				
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		// Adjust color range so that colors are moved from 0->curMax to 0->255
		// This will hopefully help make all pictures contribute the same if the lighting was
		// weak.
		
		var testLow = (64,255),
			testMid = (1,16),
			testHigh = levelChannel(64,128);
		
		yOffset = 0;
		var ch = 0;
		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
				// grab the red channel (all channels are equal due to grayscaling)
				ch = levelChannel(dataCached[offset],max);
				
				dataCached[offset] = ch;
				dataCached[offset+1] = ch;
				dataCached[offset+2] =ch;
				
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		
		
		
		normalizer.putImageData(canvas,data);
		return data;
	}
	
	function initImp(){
		// Create Normal Map Canvas
		nmCanvas = normalizer.createCanvas(imageWidth,imageHeight);
		nmCtx = normalizer.getContext(nmCanvas);
		var nmData = normalizer.createImageData(nmCanvas);
		
		// Build normal map by combining all source images into it
		var nmDataCached = nmData.data;
		
		// Get the imageData of all the lighting images
		var rightData = preprocessCanvas(canvases.right).data;
		var frontData = preprocessCanvas(canvases.front).data;
		var leftData = preprocessCanvas(canvases.left).data;
		var backData = preprocessCanvas(canvases.back).data;
		var topData = preprocessCanvas(canvases.top).data;
		var bottomData = preprocessCanvas(canvases.top).data;
		
		// Preprocess canvas version of photos. (Grey scale and color range correction)
		
		// The coordinates space we are using is
		//		     -Y    
		// 			    ^  -Z
		// 			    |  /
		//          | /
		// -X <---- 0 ----> +X
		//         /|
		//		    /	|
		//		   /	V
		//	   +Z  +Y
		
		// Create a normal map array
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth;
		for(var y = 0; y<imageHeight; y++){
			var offset=yOffset;
			for(var x = 0; x<imageWidth; x++){
				
				//offset= y*quadrupleWidth+64
				// red (left/right)
				// green (front/back)
				// blue (top/bottom)	NOTE: Bottom shot needs to be taken next time.
				//						Would like to make code work with missing images as
				//						best as it can.
				
				var c = normalizer.encodeNormal(normalizer.channelsToNormal({
					r: [leftData[offset],rightData[offset]],
					g: [topData[offset],bottomData[offset]],
					b: [backData[offset],frontData[offset]]
				}));
				
				nmDataCached[offset] = c.r;
				nmDataCached[offset+1] = c.g;
				nmDataCached[offset+2] = c.b;
				// Alpha
				nmDataCached[offset+3]=255;
				
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		
		// Update the normal map with this new data
		normalizer.putImageData(nmCanvas,nmData);
		// Copy the normal map to the output image
		outCanvas = normalizer.createCanvas(imageWidth,imageHeight);
		normalizer.getContext(outCanvas).drawImage(nmCanvas,0,0);
		
		// Create another canvas that is for storing the lighting only contributions during lighting
		lightingCanvas = normalizer.createCanvas(imageWidth,imageHeight);
		
		normalizer.getContext(outCanvas).fillStyle = "rgba(0,0,0,1)";
		normalizer.getContext(outCanvas).fillRect(0, 0, imageWidth,imageHeight);
		

	}
	
	normalizer.loadImages = function(images,imagesLoaded,cb){
		// Count the amount of images in the images associative map
		var imageCount = 0,
			loadCount = 0;
		$.each(images,function(key,value){
			imageCount++;
		});
		
		// Load the images, once done loading them all call the supplied callback function
		$.each(images,function(key,value){
			var newImage = new Image();
			imagesLoaded[key] = newImage;
			$(newImage).attr('src', value).load(function() {
				imageWidth = this.width;
				imageHeight = this.height;
				loadCount++;

				// On the last load call back, initialize everything
				if(loadCount==imageCount){
					// Fire callback
					cb();
				}
			});
		});
	}
	
	// public functions
	normalizer.init = function(settings){
		if(settings.normals){
			if(typeof(settings.normals)=="function"){
				nmCanvas = settings.normals();
				imageWidth = nmCanvas.width;
				imageHeight = nmCanvas.height;
		
				// Create an two extra canvases for doing more advanced effects
				mixerCanvas = normalizer.createCanvas(imageWidth,imageHeight);
				mixer2Canvas = normalizer.createCanvas(imageWidth,imageHeight);
				
		
				// Copy the normal map to the output image
				outCanvas = normalizer.createCanvas(imageWidth,imageHeight);
				
				// Create a canvas for storing the pure lighting calculations during the lighting calculations
				// (Useful for glow effect and debugging
				lightingCanvas = normalizer.createCanvas(imageWidth,imageHeight);
				
				
				normalizer.getContext(outCanvas).fillStyle = "rgba(0,0,0,1)";
				normalizer.getContext(outCanvas).fillRect(0, 0, imageWidth,imageHeight);
						
						
				
				normalizer.createAxisImagesFromNormal(nmCanvas);
				
				// If a callback was provided for images being loaded
				// call it now
				if(settings.cb)
					settings.cb();
				return;
			}
			else if(typeof(settings.normals)=="object"){
				// load image and don't initialize until it comes in
				//var newImage = new Image();
				
				// Call resource loading utility system
				normalizer.loadImages(settings.normals,images,function(){
					// store image width/height
					imageWidth = images['normalsImage'].width;
					imageHeight = images['normalsImage'].height;
					
					// 
					var diffuseWidth = images['colorsImage'].width,
						diffuseHeight = images['colorsImage'].height;
					
					// Create an extra canvas for doing more advanced effects
					mixerCanvas = normalizer.createCanvas(diffuseWidth,diffuseHeight);
					// Copy the colorsImage into a canvas for extracting it's channel values
					diffuseCanvas = normalizer.createCanvas(diffuseWidth,diffuseHeight);
					normalizer.getContext(diffuseCanvas).drawImage(images['colorsImage'],0,0);
					
					// Create a canvas per color channel (These are to support colored light sources)
					for(var c = 0; c<3;c++){
						// Create Canvas
						diffuseChannels.push(normalizer.createCanvas(diffuseWidth,diffuseHeight));
						// Get Image data for pixel manipulation
						var channelData = normalizer.getImageData(diffuseChannels[c]),
							channelDataCached = channelData.data,
							diffuseData = normalizer.getImageData(diffuseCanvas),
							diffuseDataCached = diffuseData.data;
										
						var yOffset = 0,
							quadrupleWidth = 4*diffuseWidth;
						for(var y = 0; y<diffuseHeight; y++){
							var offset=yOffset;
							for(var x = 0; x<diffuseWidth; x++){
							
								// 
								channelDataCached[offset+c] = diffuseDataCached[offset+c];
								channelDataCached[offset+3]=diffuseDataCached[offset+3];
								
								offset+=4;
							}
							yOffset+=quadrupleWidth;
						}
						// Update the normal map with this new data
						normalizer.putImageData(diffuseChannels[c],channelData);
					}
					
					// Create Normal Map Canvas and copy image into it
					nmCanvas = normalizer.createCanvas(imageWidth,imageHeight);
					normalizer.getContext(nmCanvas).drawImage(images['normalsImage'],0,0);
					
					// Pre-decode r,g,b colors into x,y,z normals
					normalizer.createRealNormals();
					
					outCanvas = normalizer.createCanvas(imageWidth,imageHeight);
					
					normalizer.getContext(outCanvas).fillStyle = "rgba(0,0,0,1)";
					normalizer.getContext(outCanvas).fillRect(0, 0, imageWidth,imageHeight);
					
					// Create a canvas for storing the pure lighting calculations during the lighting calculations
					// (Useful for glow effect and debugging
					lightingCanvas = normalizer.createCanvas(imageWidth,imageHeight);
					
					// If a callback was provided for images being loaded
					// call it now
					if(settings.cb)
						settings.cb();
				});	
				return;
			}
		}
	
	
		// Preload everything before actually doing anything.
		// When preloading is done, all images will be stored for later use.
		// After preloading our internal implementation init function is called to do
		// precalculations.
		
		// Count the amount of images in the images associative map
		var imageCount = 0;
		$.each(settings.images,function(key,value){imageCount++;});
		
		// Preload images
		var loadCount = 0;
		$.each(settings.images,function(key,value){
			var newImage = new Image();
			images[key] = newImage;
			$(newImage).attr('src', value).load(function() {
				imageWidth = this.width;
				imageHeight = this.height;
				loadCount++;
				
				var newCanvas = normalizer.createCanvas(imageWidth,imageHeight);
				normalizer.getContext(newCanvas).drawImage(newImage,0,0);
				canvases[key] = newCanvas;

				// On the last load call back, initialize everything
				if(loadCount==imageCount){
					
					// Initialize for real now.
					initImp(settings);
					
					// Create an extra canvas for doing more advanced effects
					mixerCanvas = normalizer.createCanvas(imageWidth,imageHeight);
					
					// If a callback was provided for images being loaded
					// call it now
					if(settings.cb)
						settings.cb();
				}
			});
		});
		
		// Check if we were provided a normal map
	}
	
	// Accessors
	
	normalizer.getImage = function(name){
		return images[name];
	}
	
	normalizer.getAxisCanvas = function(name){
		return canvases[name];
	}
	normalizer.getNormalMapArray = function(){
		
	}
	normalizer.getNormalMapImage = function(){
		return nmCanvas;
	}
	normalizer.getOutputImage = function(){
		return outCanvas;
	}
	normalizer.sphereIntersect = function(sphere,ray){
		var a = Math.pow(ray.dir.x,2)+Math.pow(ray.dir.y,2)+Math.pow(ray.dir.z,2);
		var b = 2*(ray.start.x-sphere.x)*ray.dir.x + 2*(ray.start.y-sphere.y)*ray.dir.y + 2*(ray.start.z-sphere.z)*ray.dir.z;
		var c = Math.pow(ray.start.x-sphere.x,2) + Math.pow(ray.start.y-sphere.y,2) + Math.pow(ray.start.z-sphere.z,2) - sphere.r*sphere.r;
		var discriminant = b*b-4*a*c;
		
		var result = {
			x:0,
			y:0,
			z:0,
			hit: false
		};
		
		if (discriminant < 0)
			return result;
		else if(discriminant==0){
			var t = -b/(2*a);
			result.x = ray.start.x+t*ray.x;
			result.y = ray.start.y+t*ray.y;
			result.z = ray.start.z+t*ray.z;
			result.hit = true;
			return result;
		}
		else{
			var t1 = (-b-Math.sqrt(discriminant))/(2*a),
				t2= (Math.sqrt(discriminant)-b)/(2*a),
				closest;
			// Figure out which one is 
			
			if(t1<t2)
				closest = t1;
			else
				closest = t2;
			result.x = ray.start.x+closest*ray.dir.x;
			result.y = ray.start.y+closest*ray.dir.y;
			result.z = ray.start.z+closest*ray.dir.z;
			result.hit = true;
			return result;
		}
		
		/*
		if (discriminant < 0)
			return [];
		if (discriminant == 0) return [-b/(2*a)];
		return [(-b-Math.sqrt(discriminant))/(2*a),(Math.sqrt(discriminant)-b)/(2*a)];*/
	}
	
	// Manipulators
	normalizer.normalizeNormalMap = function(){
		var nmData = getImageData(nmCanvas),
			nmDataCached = nmData.data;
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			offset,x,y;
		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
				
				// Create vector from normal map pixel;
				var n = decodeColor(
					nmDataCached[offset],
					nmDataCached[offset+1],
					nmDataCached[offset+2]
				);
				n = normalize(n);
				var c = encodeNormal(n);
				nmDataCached[offset] = c.r;
				nmDataCached[offset+1] = c.g;
				nmDataCached[offset+2] = c.b;
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		putImageData(nmCanvas,nmData);
	}
	
	normalizer.scaleVector = function(v,s){
		var o = {
			x: v.x*s,
			y: v.y*s,
			z: v.z*s
		};
		return o;
	}
	normalizer.addVector = function(v1,v2){
		var o = {
			x: v1.x+v2.x,
			y: v1.y+v2.y,
			z: v1.z+v2.z
		};
		return o;
	}
	
	normalizer.smoothNormals = function(){
		var nmData = normalizer.getImageData(nmCanvas),
			nmDataCached = nmData.data;
			
		var quadrupleWidth = 4*imageWidth,
			yOffset = quadrupleWidth,
			offset,x,y,
			averageScalar = 1/9;

		for(y = 1; y<imageHeight-1; y++){
			offset=yOffset+4;
			for(x = 1; x<imageWidth-1; x++){
				var TL = decodeColor(
						nmDataCached[offset-quadrupleWidth-4],
						nmDataCached[offset+1-quadrupleWidth-4],
						nmDataCached[offset+2-quadrupleWidth-4]
					),
					T = decodeColor(
						nmDataCached[offset-quadrupleWidth],
						nmDataCached[offset+1-quadrupleWidth],
						nmDataCached[offset+2-quadrupleWidth]
					),
					TR = decodeColor(
						nmDataCached[offset-quadrupleWidth+4],
						nmDataCached[offset+1-quadrupleWidth+4],
						nmDataCached[offset+2-quadrupleWidth+4]
					),
					R = decodeColor(
						nmDataCached[offset+4],
						nmDataCached[offset+1+4],
						nmDataCached[offset+2+4]
					),
					BR = decodeColor(
						nmDataCached[offset+quadrupleWidth+4],
						nmDataCached[offset+1+quadrupleWidth+4],
						nmDataCached[offset+2+quadrupleWidth+4]
					),
					B = decodeColor(
						nmDataCached[offset+quadrupleWidth],
						nmDataCached[offset+1+quadrupleWidth],
						nmDataCached[offset+2+quadrupleWidth]
					),
					BL = decodeColor(
						nmDataCached[offset+quadrupleWidth-4],
						nmDataCached[offset+1+quadrupleWidth-4],
						nmDataCached[offset+2+quadrupleWidth-4]
					),
					L = decodeColor(
						nmDataCached[offset-4],
						nmDataCached[offset+1-4],
						nmDataCached[offset+2-4]
					),
					S = decodeColor(
						nmDataCached[offset],
						nmDataCached[offset+1],
						nmDataCached[offset+2]
					);
					
				// Average it all together
					// First scale down each down by their contributions (1/9 for 9 samples)
				TL = normalizer.scaleVector(TL,averageScalar);
				T = normalizer.scaleVector(T,averageScalar);
				TR = normalizer.scaleVector(TR,averageScalar);
				R = normalizer.scaleVector(R,averageScalar);
				BR = normalizer.scaleVector(BR,averageScalar);
				B = normalizer.scaleVector(B,averageScalar);
				BL = normalizer.scaleVector(BL,averageScalar);
				L = normalizer.scaleVector(L,averageScalar);
				S = normalizer.scaleVector(S,averageScalar);
					// Add them all together
				var n =	normalizer.addVector(TL,
						normalizer.addVector(T,
						normalizer.addVector(TR,
						normalizer.addVector(R,
						normalizer.addVector(BR,
						normalizer.addVector(B,
						normalizer.addVector(BL,
						normalizer.addVector(L,S))))))));
				n = normalizer.normalize(n);
				var c = normalizer.encodeNormal(n);
				
				// Set the color based on the smoothed normal
				nmDataCached[offset] = c.r;
				nmDataCached[offset+1] = c.g;
				nmDataCached[offset+2] = c.b;
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		normalizer.putImageData(nmCanvas,nmData);
	}
	
	normalizer.drawNormals = function(app,gridX,gridY,len){
		var nmData = normalizer.getImageData(nmCanvas),
			nmDataCached = nmData.data;
			
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			offset,x,y;
		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
				
				
				if( ((x%gridX)==0) && ((y%gridY)==0) ){
					// Create vector from normal map pixel;
					var n = decodeColor(
						nmDataCached[offset],
						nmDataCached[offset+1],
						nmDataCached[offset+2]
					);
					
					app.line(
						x,y,
						x+Math.floor(len*n.x),y+Math.floor(len*n.y),
						app.rgba(0,0,255,1)
					);
				}
			

				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
	//	normalizer.putImageData(outCanvas,outData);
	}
	normalizer.calculateLight = function(l,mode){
		normalizer.calculateLightWithRealNormals(l,mode);
		return;
		var rL = {
				x: -l.x,
				y: -l.y,
				z: -l.z
			},
			
		rL = normalizer.normalize(rL);
		// Create non member versions of the light (Faster than member access in render loop below
		var	lX=rL.x,
			lY=rL.y,
			lZ=rL.z;
	
		var nmData = normalizer.getImageData(nmCanvas),
			nmDataCached = nmData.data,
			outData = normalizer.getImageData(outCanvas),
			outDataCached = outData.data;
			
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			offset,x,y,d,c,n,r,g,b;
		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
			
				// Inline normalizer.decodeColor
				// var n = decodeColor(
				//		nmDataCached[offset],
				// 		mDataCached[offset+1],
				// 		nmDataCached[offset+2]
				// );
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

				// Inline normalizer.dotProduct
				//var d = normalizer.dotProduct(n,rL);
				d = r*lX+g*lY+b*lZ;//+dy+dz;
				
				
				if(d<=0.0){
					c = 255;
				}
				else{
					c = 255-d*255;
				}
				outDataCached[offset+3] = c;
			
				offset+=4;
			}
			yOffset+=quadrupleWidth;
		}
		normalizer.putImageData(outCanvas,outData);
	}
	
	normalizer.calculateLightWithRealNormals = function(l,mode){
		var rL = {
				x: -l.x,
				y: -l.y,
				z: -l.z
			},
			
		rL = normalizer.normalize(rL);
		// Create non member versions of the light (Faster than member access in render loop below)
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
			
				// Inline normalizer.decodeColor
				// var n = decodeColor(
				//		nmDataCached[offset],
				// 		mDataCached[offset+1],
				// 		nmDataCached[offset+2]
				// );

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
	
	normalizer.calculateLightWithRealNormalsXZ = function(l,mode){
		var rL = {
				x: -l.x,
				y: -l.y,
				z: -l.z
			},
			
		rL = normalizer.normalize(rL);
		// Create non member versions of the light (Faster than member access in render loop below
		var	lX=rL.x,
			lY=rL.y,
			lZ=rL.z;
	
		var nmData = normalizer.getImageData(nmCanvas),
			nmDataCached = nmData.data,
			outData = normalizer.getImageData(outCanvas),
			outDataCached = outData.data;
			
		var yOffset = 0,
			quadrupleWidth = 4*imageWidth,
			offset,x,y,d,c,n,r,g,b,realOffset=0;
		for(y = 0; y<imageHeight; y++){
			offset=yOffset;
			for(x = 0; x<imageWidth; x++){
			
				// Inline normalizer.decodeColor
				// var n = decodeColor(
				//		nmDataCached[offset],
				// 		mDataCached[offset+1],
				// 		nmDataCached[offset+2]
				// );

				// Inline normalizer.dotProduct
				//var d = normalizer.dotProduct(n,rL);
				d = realNormalsX[realOffset]*lX+realNormalsZ[realOffset]*lZ;//+dy+dz;
				
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
	
	
	var ambientWarningFired = false,
		differentSizeWarningFired = false;
	normalizer.glow = function(cvs,options){
		
		// We don't currently support glow effects with normal maps that are not the same size as the diffuse map
		if(normalizer.getImage("colorsImage").width!=normalizer.getOutputImage().width||normalizer.getImage("colorsImage").height!=normalizer.getOutputImage().height){
			if(!differentSizeWarningFired){
		//	console.log("The glow effect does not currently support it when the normal map and the diffuse map are different sizes");
				differentSizeWarningFired = true;		
			}
		}
		
		var s = 3,
			w = 4,
			h = 4,
			xS = -(w*s-s)/2,
			yS = -(h*s-s)/2,
			range=20.0,
			alpha=range/255.0/w*h,
			ctx = normalizer.getContext(cvs);

		// Check if there is ambient lighting contributions to output a warning that glow doesn't support that
		// (Helpful when the glow effect doesn't work as expected.
		var lightColor = [options.ambient.r,options.ambient.g,options.ambient.b],
			c;
		for(c=0; c<3; c++){
			if(lightColor[c]!=0){
				if(!ambientWarningFired){
		//			console.log("Glow doesn't currently support, ignoring for now in glow effect.");
					ambientWarningFired = true;
				}
			}
		}

		// Use Mixer canvas to make glow effect
			// First clear mixer to black
		normalizer.getContext(mixerCanvas).globalCompositeOperation = "source-over";
		normalizer.getContext(mixerCanvas).globalAlpha = 1.0;
		normalizer.getContext(mixerCanvas).fillStyle = "rgba(0,0,0,1)";
		normalizer.getContext(mixerCanvas).fillRect(0, 0, cvs.width,cvs.height);
			// Draw Output image scaled by the top range of color we are hoping to only add (16 for example should only add colors that are above 255-16)
		normalizer.getContext(mixerCanvas).globalAlpha = alpha;
		normalizer.getContext(mixerCanvas).drawImage(cvs,0,0)
	
		// Add glow to existing outputted images
		ctx.globalCompositeOperation = "lighter";
		ctx.globalAlpha = 1;
		for(var y = 0; y<h; y++){
			for(var x = 0; x<w; x++){
				ctx.drawImage(mixerCanvas,
					Math.floor(xS+x*s),Math.floor(yS+y*s),cvs.width,cvs.height);
			}
		}
		ctx.globalCompositeOperation = "source-over";
	}
	
	function almost(valueA,valueB,epsilon){
		return Math.abs(valueA-valueB)<=epsilon;
	}
	
	normalizer.light = function(cvs,options){
		var img = normalizer.getImage("colorsImage"),
			c,
			lightColor,
			ctx = normalizer.getContext(cvs),
			lCtx = normalizer.getContext(lightingCanvas);
				
		// Clear to black to make it so that you can lighten diffuse image by using alpha combined with the black background
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1;
		ctx.fillStyle = "rgba(0,0,0,1)";
		ctx.fillRect(0, 0, img.width, img.height);
		
		lCtx.globalCompositeOperation = "source-over";
		lCtx.globalAlpha = 1;
		lCtx.fillStyle = "rgba(0,0,0,1)";
		lCtx.fillRect(0, 0, img.width, img.height);
		

		// The Mixer Canvas is used for the obvious
		var mixerCtx = normalizer.getContext(mixerCanvas);
		
		//-----------------------
		// Apply Ambient Lighting First
		//-----------------------
		
		// All this does is combined the diffuse colors channels each scaled by their respective
		// ambience values
			// For the convenience of the following loop logic creat an array of the channel values
		lightColor = [options.ambient.r,options.ambient.g,options.ambient.b];
		for(c=0; c<3; c++){
			if(lightColor[c]!=0){
				// Add this channel's contribution to the output canvas
				ctx.globalAlpha = lightColor[c]/255;
				ctx.globalCompositeOperation = "lighter";
				ctx.drawImage(diffuseChannels[c],0,0);
			}
		}
		
		//
		// Calculate Directional Lighting
		// 
		ctx.globalAlpha=1.0;
		lCtx.globalAlpha=1.0;
			// For testing purposes you can change set this flag to true to render only the lighting results
			
		// Calculate each lights contribution then add them all together
		// Note: This can lead to whitening out channels if enough lights are added together. (Plus ambient lighting as well.)
		for(var l=0; l<options.lights.length; l++){
			//
			normalizer.calculateLightWithRealNormals(options.lights[l].dir)
		
			// Clear Mixer to black
			mixerCtx.globalCompositeOperation = "source-over";
			mixerCtx.globalAlpha = 1;
			mixerCtx.fillStyle = "rgba(0,0,0,1)";
			mixerCtx.fillRect(0, 0, img.width, img.height);
		
			// Combine all the color channels into one image
			
			// For the convenience of the following loop logic creat an array of the channel values
			lightColor = [options.lights[l].color.r,options.lights[l].color.g,options.lights[l].color.b];
			for(c = 0; c<3; c++){
				
			
				// Combine lighting and channel's diffuse color into the mixer canvas
				// Then combine them together by additively compositing them
				// (This works because each channel is isolated so additively combining a channel
				// does not interfere with any of the other channels)
					// First set the mixer to the channel's values
					// Scale the channel's contribution based on the light's color channels
				if(lightColor[c]!=0){	
					// Clear Mixer to black
					mixerCtx.globalCompositeOperation = "source-over";
					mixerCtx.globalAlpha = 1;
					mixerCtx.fillStyle = "rgba(0,0,0,1)";
					mixerCtx.fillRect(0, 0, img.width, img.height);	

					mixerCtx.globalAlpha = lightColor[c]/255;
					mixerCtx.drawImage(diffuseChannels[c],0,0);
	
					//
					// Calculate Regular Lighting first
					//
					
					// Then combine it with the calculated lighting
					mixerCtx.drawImage(normalizer.getOutputImage(),
						0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,
						0,0,img.width,img.height);
							
					// Add this channel's contribution to the output canvas
					ctx.globalCompositeOperation = "lighter";
					ctx.drawImage(mixerCanvas,0,0);
					
					// 
					// Calculate Lighting Only Output
					// Store Lighting only results into the lightingCanvas
					
					// Clear Mixer to black
					mixerCtx.globalCompositeOperation = "source-over";
					mixerCtx.globalAlpha = 1;
					mixerCtx.fillStyle = "rgba(0,0,0,1)";
					mixerCtx.fillRect(0, 0, img.width, img.height);	
					
					
					var col = {
						r: (c==0)?lightColor[c]:0,
						g: (c==1)?lightColor[c]:0,
						b: (c==2)?lightColor[c]:0
					};
					
					mixerCtx.fillStyle = "rgba("+col.r+","+col.g+","+col.b+",1)";
					mixerCtx.fillRect(0, 0, img.width, img.height);
					mixerCtx.drawImage(normalizer.getOutputImage(),0,0,img.width,img.height);
					
					// Add this channel's contribution to the output canvas
					lCtx.globalCompositeOperation = "lighter";
					lCtx.drawImage(mixerCanvas,0,0);
					
					
				}
			}
		}	
		
		// Make sure global settings are back to default (This should be done with pushing/popping but I'm too lazy to implement that.
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha =1.0;
	}
	
	normalizer.draw = function(ctx,r,g,b){
		var img = normalizer.getImage("colorsImage");
				
		// Clear to black to make it so that you can lighten diffuse image by using alpha combined with the black background
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1;
		ctx.fillStyle = "rgba(0,0,0,1)";
		ctx.fillRect(0, 0, img.width, img.height);
		
		// Combine all the color channels into one image
		var mixerCtx = normalizer.getContext(mixerCanvas);
		mixerCtx.globalCompositeOperation = "source-over";
		
		// Clear Mixer to black
		mixerCtx.globalCompositeOperation = "source-over";
		mixerCtx.globalAlpha = 1;
		mixerCtx.fillStyle = "rgba(0,0,0,1)";
		mixerCtx.fillRect(0, 0, img.width, img.height);
		
		
		// For the convenience of the following loop logic creat an array of the channel values
		var lightColor = [r,g,b]
		for(var c = 0; c<3; c++){
			var channelCtx = normalizer.getContext(diffuseChannels[c]);
			// Combine lighting and channel's diffuse color into the mixer canvas
			// Then combine them together by additively compositing them
			// (This works because each channel is isolated so additively combining a channel
			// does not interfere with any of the other channels)
				// First set the mixer to the channel's values
				// Scale the channel's contribution based on the light's color channels
			mixerCtx.globalAlpha = lightColor[c]/255;
			mixerCtx.drawImage(diffuseChannels[c],0,0);
			
			// Then combine it with the calculated lighting
				// Special Case for if the normal map is exactly half the dimensions of the diffuse map
				// This attempts to create a near bilinear quality upsampling of the lighting results image
			if(0){//almost(img.width,(imageWidth*2),2)&&almost(img.height,(imageHeight*2),2)){
				var restoreAlpha =mixerCtx.globalAlpha;
				mixerCtx.globalAlpha = lightColor[c]/255*(1/4.0);	
	
				var oX=0.5,
					oY=0.5;
				
				
				
				// tl,t,tr
				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,-oX,-oY,img.width,img.height);
//				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,0,-oY,img.width,img.height);
				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,oX,-oY,img.width,img.height);
				// mr
//				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,oX,0,img.width,img.height);
				// br,b,bl
				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,oX,oY,img.width,img.height);
//				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,0,oY,img.width,img.height);
				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,-oX,oY,img.width,img.height);
				// ml
//				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,-oX,0,img.width,img.height);
				// self
//				mixerCtx.drawImage(normalizer.getOutputImage(),0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,0,0,img.width,img.height);
				
				mixerCtx.globalAlpha = restoreAlpha;
			}
			// Regular unweighted render
			else{

				mixerCtx.drawImage(normalizer.getOutputImage(),
					0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,
					0,0,img.width,img.height);
			}	
						
			// Add this channel's contribution to the output canvas
			ctx.globalCompositeOperation = "lighter";
			ctx.drawImage(mixerCanvas,0,0);
		}
		return;
		
		
		
		

		if(img)
			ctx.drawImage(img,0,0);
		// Additively add the lighting on top (It's an approximation, as we can't do multiplication)
		
		

		else{
			ctx.globalAlpha = 1;
			//ctx.globalCompositeOperation = "lighter";
			ctx.drawImage(normalizer.getOutputImage(),
				0,0,normalizer.getOutputImage().width,normalizer.getOutputImage().height,
				0,0,img.width,img.height);
		}
		
		
	}

}());