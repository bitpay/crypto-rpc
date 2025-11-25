# Wipes all docker containers and prunes images/builders.
# Run this when you're suddenly getting unexpected errors with
# docker containers/images after having run tests multiple times
docker compose down --rmi all --volumes --remove-orphans
docker container rm $(docker container ls -a -q --filter name=crypto-rpc*)
docker image prune && docker builder prune