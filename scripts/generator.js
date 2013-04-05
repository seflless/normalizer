// Anonymous Wrapper Function to prevent local variables name pollution
(function(){
	generator = {};

	generator.run = function(options){
		var normalsCanvas,
		frontCanvas,
		progressCBCounts=0;
	
		function drawResults(results){
			// If this is an incremental update draw just the square
			if(results.canvasName){
				// Is this the normals canvas?
				if(results.canvasName=="normals"){
					document.getElementById("normals").getContext('2d').drawImage(
						results.normals,
						results.x,results.y,results.width,results.height,
						results.x,results.y,results.width,results.height);
				}
				// Or is it one of the axis normals
				else{
					document.getElementById(results.canvasName).getContext('2d').drawImage(
						results.axises[results.canvasName],
						results.x,results.y,results.width,results.height,
						results.x,results.y,results.width,results.height);
				}
			}
			// Otherwise draw everything
			else{
				document.getElementById("normals").getContext('2d').drawImage(results.normals,0,0);
				document.getElementById("diffuse").getContext('2d').drawImage(results.diffuse,0,0);
				
				for(var i in results.axises){
					var elem = document.getElementById(i);
					elem.getContext('2d').drawImage(results.axises[i],0,0);
				}
			}
		}
	
		var delay = options.delay,
			currentProcess = "",
			lastCanvasName="left";
	
		normalizer.create({
			images:options.images,
			colorAdjust:options.colorAdjust,
			delay:delay,
			chunkWidth:options.chunkWidth,
			chunkHeight:options.chunkHeight,
			onStart:function(results){
				document.getElementById('status').innerHTML = "Seperating Colors";
			
				// Draw the diffuse image
				document.getElementById("diffuse").getContext('2d').drawImage(results.diffuse,0,0);
				
				// Seperate the diffuse image into seperate color channel images
				// Then draw them.
				var channels = normalizer.channels(results.diffuse);
				for(var ch in channels){
					var elem = document.getElementById(ch);
					elem.getContext('2d').drawImage(channels[ch],0,0);
				}
				
				currentProcess = 'Grey Scaling';
				document.getElementById('status').innerHTML = currentProcess+' (Red)';
			},
			onFinish:function(results){
				// Draw Results
				drawResults(results);
				
				if(!options.smoothNormals){
					document.getElementById('status').innerHTML = "Finished";
				}
				else{
					document.getElementById('status').innerHTML = "Smoothing";
					
					// Optionally smooth normals if you are seeing hard-edged or other types of artifacts
					normalizer.smooth({
						normals:results.normals,
						delay:options.delay,
						chunkWidth:options.chunkWidth,
						chunkHeight:options.chunkHeight,
						onProgress:function(results){
							// Draw currently calculate chunk
							document.getElementById("normals").getContext('2d').drawImage(
								results.normals,
								results.x,results.y,results.width,results.height,
								results.x,results.y,results.width,results.height);
						},
						onFinish:function(results){
							document.getElementById('status').innerHTML = "Finished";
							
							// If delay was set to zero no onProgress() calls were made so we have to draw the smoothed normals now
							// because they are usually drawn in there.
							if(delay==0){
								// Draw currently calculate chunk
								document.getElementById("normals").getContext('2d').drawImage(results.normals,0,0);
							}
						}
					});
				}
			},
			// Optionally pass onProgress() callback can be passed
			// This will make the creationFunction incrementally calculate the normals.
			// This is very useful for preventing the browser from poping up dialogs because
			// The script is taking too long. It uses setTimeout with a few milliseconds between to allow
			// the browser to do it's thing.
			onProgress: function(results){
				// Only update Status when it's a new canvas we are processing.
				if(lastCanvasName!=results.canvasName){
					// If this is our second showing of red then we know it's now the color adjusting phase if it's
					// been turned on.
					if(results.canvasName=="left"){
						currentProcess = 'Color Adjusting';
					}
					
					if(results.canvasName=="normals"){
						document.getElementById('status').innerHTML = "Calculating Normals";
					}else{
						document.getElementById('status').innerHTML = currentProcess+' ('+results.canvasName+')';
					}
					lastCanvasName=results.canvasName;
				}
				
				drawResults(results);
		
				// Print how many times the call back is called.
				//console.log(progressCBCounts++);
			}
		});
	}
})();