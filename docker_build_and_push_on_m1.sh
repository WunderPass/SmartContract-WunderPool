#!/bin/bash
TAG=$1

# building docker container on Mac with M1 chip results in errors when attempting to start on github actions with ubuntu runner
# steps to solve this issue found here: https://medium.com/geekculture/docker-build-with-mac-m1-d668c802ab96

# prerequisite: - need to be in the directory of the Dockerfile 
#		- need to be logged in into dockerhub
# usage:        ./docker_build_and_push_on_m1.sh [docker-hubid/image-tag]
# example:      ./docker_build_and_push_on_m1.sh wunderpass/hardhat-node:0.0.4

docker buildx create --name mybuilder
docker buildx use mybuilder
docker buildx build --push --tag $TAG --platform=linux/amd64 .
docker buildx rm mybuilder
