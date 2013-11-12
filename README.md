# Overview

This is the start of a project to make it easy for anyone to generate and render normal maps all using Javascript. 


# Live Demos

  - [Real time rendering](http://francoislaberge.com/labs/normal_mapping/me/) (Personal website demos)
  - [Generating Normal Maps](http://francoislaberge.github.io/normalizer/) (Available in source)
  

# Running demos locally

To run the demos locally, you must host the files in this project. Otherwise you'll get a security error because the demos require reading the pixels of loaded images which isn't allowed for HTML loaded on the file:/// protocol.

  1. We provide a simple Python based server for you to host files. Run the following from the command line while inside the root folder
    
    
        ./server

    
  2. Now open [http://localhost:8080/](http://localhost:8080/) and select a demo.

# TODO: 

  1. Port over and cleanup real time rendering code from the live demos.
  2. Write up on how to us a camera to take photos that you can extract the normals of every day objects [(As seen in these demos)](http://francoislaberge.com/labs/normal_mapping/me/)
