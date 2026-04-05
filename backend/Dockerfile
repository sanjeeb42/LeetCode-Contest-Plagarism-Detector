# Use an official Python runtime as a parent image
FROM python:3.9-slim-bookworm

# Install OpenJDK 17 for JPlag
RUN apt-get update && \
    apt-get install -y openjdk-17-jdk-headless && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set Java HOME
ENV JAVA_HOME /usr/lib/jvm/java-17-openjdk-amd64
ENV PATH $JAVA_HOME/bin:$PATH

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend directory contents into the container at /app
COPY . .

# Environment variables for Docker
ENV PORT=5050
EXPOSE 5050

# Run the Flask server
CMD ["python", "server.py"]
