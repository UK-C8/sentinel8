FROM python:3.12-slim

# System tools: git, curl, trivy, semgrep, gitleaks
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates wget unzip \
    && rm -rf /var/lib/apt/lists/*

# Trivy
RUN TRIVY_VERSION=$(curl -s https://api.github.com/repos/aquasecurity/trivy/releases/latest | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/') \
    && curl -sfL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.deb" -o /tmp/trivy.deb \
    && dpkg -i /tmp/trivy.deb && rm /tmp/trivy.deb

# Gitleaks
RUN GITLEAKS_VERSION=$(curl -s https://api.github.com/repos/gitleaks/gitleaks/releases/latest | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/') \
    && curl -sfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" | tar -xz -C /usr/local/bin gitleaks

# Semgrep
RUN pip install --no-cache-dir semgrep

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV POLL_INTERVAL_SECONDS=15

CMD ["python", "worker.py"]
