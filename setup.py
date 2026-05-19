from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

setup(
    name="sixs_app",
    version="0.0.1",
    description="SIXS App — Custom dashboards, reports and portals for ERPNext",
    author="Dércio Bobo",
    author_email="derciobob@gmail.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
