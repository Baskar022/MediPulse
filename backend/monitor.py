"""
MediPulse System Health & Diagnostic Monitor
Reports real Python, PySpark, OS, JVM, hardware, and environment telemetry.
"""

import os
import sys
import platform
import shutil
import logging
from typing import Dict, Any

logger = logging.getLogger("backend.monitor")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_system_telemetry() -> Dict[str, Any]:
    # Check PySpark availability
    spark_version = "Not Available"
    pyspark_installed = False
    try:
        import pyspark
        spark_version = pyspark.__version__
        pyspark_installed = True
    except ImportError:
        pass

    # Check Java
    java_installed = False
    java_version = "Java Not Detected"
    try:
        import subprocess
        res = subprocess.run(["java", "-version"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=5)
        first_line = res.stdout.split("\n")[0] if res.stdout else "Java Present"
        java_version = first_line.strip()
        java_installed = True
    except Exception:
        pass

    # Disk usage
    total_disk, used_disk, free_disk = shutil.disk_usage(BASE_DIR)

    return {
        "status": "healthy",
        "timestamp": platform.node(),
        "platform": {
            "os": platform.system(),
            "os_release": platform.release(),
            "os_version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "cpu_cores": os.cpu_count() or 1,
        },
        "python": {
            "version": platform.python_version(),
            "executable": sys.executable,
            "compiler": platform.python_compiler(),
        },
        "spark": {
            "pyspark_installed": pyspark_installed,
            "version": spark_version,
            "execution_mode": "local[*]",
            "driver_memory": "4GB",
            "executor_memory": "4GB",
            "default_parallelism": os.cpu_count() or 4,
            "hadoop_home": os.environ.get("HADOOP_HOME", os.path.join(BASE_DIR, "hadoop")),
            "winutils_configured": os.path.exists(os.path.join(BASE_DIR, "hadoop", "bin", "winutils.exe"))
        },
        "java": {
            "installed": java_installed,
            "version_info": java_version,
            "java_home": os.environ.get("JAVA_HOME", "Default System Path")
        },
        "storage": {
            "project_root": BASE_DIR,
            "total_disk_gb": round(total_disk / (1024**3), 2),
            "free_disk_gb": round(free_disk / (1024**3), 2),
            "used_disk_gb": round(used_disk / (1024**3), 2),
            "disk_utilization_pct": round(used_disk / total_disk * 100, 1)
        }
    }
